// Assina, troca de plano ou troca a forma de pagamento de uma assinatura recorrente — tudo
// via Payment Brick embutido (SDK JS do Mercado Pago tokeniza o cartão dentro do próprio
// Actum, sem redirecionar pro checkout do Mercado Pago) ou, quando já existe assinatura ativa
// e só o VALOR muda (upgrade/downgrade de plano), sem precisar de cartão novo. Chamada pelo
// admin/sócio da própria empresa, autenticada (JWT). Preço vem sempre de plan_limits (nunca
// do que o client mandou), mesmo princípio já usado em signup-empresa.
//
// Dois modos, decididos pelo body:
//   { plano, card_token_id, ciclo? } — cria uma assinatura nova (do plano grátis pra um pago)
//     ou troca o cartão de uma já existente (cancela a antiga no Mercado Pago antes de criar a
//     nova, pra não cobrar duas vezes). `ciclo`: 'mensal' (default, cobra todo mês) ou 'anual'
//     (cobra o ano inteiro de uma vez, 5% de desconto sobre valor_mensal*12 — DESCONTO_ANUAL
//     abaixo, mesmo número que src/config/planos.js usa só pra exibir).
//   { plano } sem card_token_id — troca só o VALOR de uma assinatura já ativa (PUT
//     auto_recurring.transaction_amount), reaproveitando o cartão que o Mercado Pago já tem e
//     o ciclo (mensal/anual) que a assinatura já tinha — trocar de ciclo não é feito por aqui,
//     precisa assinar de novo com um card_token_id.
//
// Deploy: supabase functions deploy mercado-pago-criar-assinatura
// Secret necessário: supabase secrets set MERCADO_PAGO_ACCESS_TOKEN=<access-token-de-produção>
// (mesmo token de mercado-pago-webhook — nunca vai pro client, só Deno.env aqui.)

import { createClient } from "npm:@supabase/supabase-js@2";
import { checarBloqueioPagamento, registrarTentativaFalha, registrarTentativaSucesso } from "../_shared/limitePagamento.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DESCONTO_ANUAL = 0.05;

function valorCobranca(valorMensal: number, ciclo: string) {
  const valor = ciclo === "anual" ? valorMensal * 12 * (1 - DESCONTO_ANUAL) : valorMensal;
  return Math.round(valor * 100) / 100;
}

async function chamarMercadoPago(url: string, init: RequestInit): Promise<{ res: Response | null; erro: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return { res, erro: null };
  } catch (err) {
    const timedOut = (err as Error).name === "AbortError";
    return { res: null, erro: timedOut ? "O Mercado Pago demorou demais pra responder. Tenta de novo." : `Falha ao falar com o Mercado Pago: ${(err as Error).message}` };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) return new Response(JSON.stringify({ error: "Assinatura ainda não foi configurada. Fale com o suporte." }), { status: 503, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });

    const { data: profile } = await admin.from("profiles").select("org_id, role").eq("id", user.id).maybeSingle();
    if (!profile || !["admin", "socio"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Só admin ou sócio pode mexer na assinatura." }), { status: 403, headers: corsHeaders });
    }

    // Trava contra carding (mesmo achado real do qa-guardian que motivou isso em
    // mercado-pago-criar-pagamento-cartao/mercado-pago-criar-pix) — só se aplica de verdade
    // quando vem card_token_id (cartão novo sendo testado), mas checar sempre é mais simples
    // e não atrapalha troca de plano legítima na prática.
    const bloqueio = await checarBloqueioPagamento(admin, profile.org_id);
    if (bloqueio) return new Response(JSON.stringify({ error: bloqueio }), { status: 429, headers: corsHeaders });

    const { plano, card_token_id, ciclo } = await req.json();
    if (!plano) return new Response(JSON.stringify({ error: "Escolha um plano." }), { status: 400, headers: corsHeaders });
    // Default 'mensal' pra qualquer valor ausente/desconhecido — não quebra chamada antiga
    // (de antes do ciclo anual existir) nem confia em algo fora da lista permitida.
    const cicloEscolhido = ciclo === "anual" ? "anual" : "mensal";

    // Preço vem do banco, nunca do que o client mandou. 'gratis' não é assinável (é o trial).
    const { data: limite } = await admin.from("plan_limits").select("plano, valor_mensal").eq("plano", plano).maybeSingle();
    if (!limite || Number(limite.valor_mensal) <= 0) {
      return new Response(JSON.stringify({ error: "Plano inválido." }), { status: 400, headers: corsHeaders });
    }

    const { data: org } = await admin
      .from("organizations")
      .select("mercado_pago_subscription_id, status_pagamento, assinatura_ciclo")
      .eq("id", profile.org_id)
      .maybeSingle();

    // Modo "troca de plano" (upgrade/downgrade): assinatura já ativa, sem cartão novo — só
    // atualiza o valor cobrado no próximo ciclo, mantém o mesmo cartão E o mesmo ciclo
    // (mensal/anual) que a assinatura já tinha (trocar de ciclo exige card_token_id novo).
    if (!card_token_id) {
      if (!org?.mercado_pago_subscription_id || org.status_pagamento !== "pago") {
        return new Response(JSON.stringify({ error: "Não há assinatura ativa pra trocar de plano. Assine com um cartão primeiro." }), { status: 400, headers: corsHeaders });
      }
      const novoValor = valorCobranca(Number(limite.valor_mensal), org.assinatura_ciclo);
      const { res, erro } = await chamarMercadoPago(`https://api.mercadopago.com/preapproval/${org.mercado_pago_subscription_id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ auto_recurring: { transaction_amount: novoValor } }),
      });
      if (erro) return new Response(JSON.stringify({ error: erro }), { status: 504, headers: corsHeaders });
      if (!res!.ok) {
        const corpo = await res!.json().catch(() => null);
        return new Response(JSON.stringify({ error: corpo?.message ?? "Não foi possível trocar de plano." }), { status: 502, headers: corsHeaders });
      }
      const { error: updateError } = await admin
        .from("organizations")
        .update({ plano: limite.plano, valor_mensal: limite.valor_mensal, cancelamento_agendado_para: null })
        .eq("id", profile.org_id);
      if (updateError) throw updateError;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Modo "assinar"/"trocar cartão": cria uma assinatura nova. Se já existia uma (troca de
    // cartão, ou reassinar depois de cancelar), cancela a antiga primeiro — melhor esforço,
    // não bloqueia o fluxo se a antiga já não existir mais do lado do Mercado Pago.
    if (org?.mercado_pago_subscription_id) {
      await chamarMercadoPago(`https://api.mercadopago.com/preapproval/${org.mercado_pago_subscription_id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
    }

    const { res: preapprovalRes, erro: erroCriar } = await chamarMercadoPago("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: `Actum — Plano ${limite.plano} (${cicloEscolhido})`,
        external_reference: profile.org_id,
        payer_email: user.email,
        card_token_id,
        status: "authorized",
        auto_recurring: {
          // Cobrança anual continua "de N em N meses" (frequency=12) — API do Mercado Pago
          // não tem uma unidade "ano", frequency_type fica sempre 'months'.
          frequency: cicloEscolhido === "anual" ? 12 : 1,
          frequency_type: "months",
          transaction_amount: valorCobranca(Number(limite.valor_mensal), cicloEscolhido),
          currency_id: "BRL",
        },
      }),
    });
    if (erroCriar) return new Response(JSON.stringify({ error: erroCriar }), { status: 504, headers: corsHeaders });
    const preapproval = await preapprovalRes!.json().catch(() => null);
    if (!preapprovalRes!.ok || !preapproval?.id) {
      await registrarTentativaFalha(admin, profile.org_id);
      return new Response(JSON.stringify({ error: preapproval?.message ?? "Não foi possível criar a assinatura. Confira os dados do cartão." }), { status: 502, headers: corsHeaders });
    }
    await registrarTentativaSucesso(admin, profile.org_id);

    // status_pagamento fica 'pendente' até o webhook confirmar o primeiro pagamento de
    // verdade (subscription_authorized_payment) — nunca libera com base só na resposta
    // síncrona daqui, mesma cautela que o resto da integração já segue.
    const { error: updateError } = await admin
      .from("organizations")
      .update({
        plano: limite.plano,
        valor_mensal: limite.valor_mensal,
        status_pagamento: "pendente",
        mercado_pago_subscription_id: preapproval.id,
        assinatura_iniciada_em: new Date().toISOString(),
        cancelamento_agendado_para: null,
        assinatura_ciclo: cicloEscolhido,
      })
      .eq("id", profile.org_id);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
