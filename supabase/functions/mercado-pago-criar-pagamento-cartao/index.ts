// Gera um pagamento de CARTÃO pré-pago por período (3/6/12 meses) — trilho irmão de
// mercado-pago-criar-pix, mesma ideia (pagamento único via /v1/payments, sem token salvo pra
// cobrar de novo sozinho), só que cobrando o cartão em vez do PIX. Diferente de
// mercado-pago-criar-assinatura (Preapproval, recorrente, cancelável com fidelidade de 3
// meses): isso aqui é um pagamento avulso só, JAMAIS cancelável (já foi cobrado o valor
// total, sem como devolver parcial) — por isso nunca seta mercado_pago_subscription_id, e
// mercado-pago-cancelar-assinatura já recusa qualquer org sem essa coluna preenchida.
//
// O client tokeniza o cartão com o Card Payment Brick (mesmo SDK já usado em
// mercado-pago-criar-assinatura) e manda o formData inteiro em `brickData` — precisamos dos
// campos que o Brick já coletou (payment_method_id, issuer_id, payer.identification/CPF-CNPJ,
// exigidos pelo Mercado Pago Brasil pra pagamento direto) além do token. `installments` é
// sempre forçado pra 1 aqui, mesmo que o Brick tenha oferecido parcelamento — isso é
// pré-pagamento de período, não parcelamento de compra.
//
// Deploy: supabase functions deploy mercado-pago-criar-pagamento-cartao
// Secret necessário: supabase secrets set MERCADO_PAGO_ACCESS_TOKEN=<access-token-de-produção>

import { createClient } from "npm:@supabase/supabase-js@2";
import { mesesValidos, valorPagamentoAvulso } from "../_shared/pagamentoAvulso.ts";
import { checarBloqueioPagamento, registrarTentativaFalha, registrarTentativaSucesso } from "../_shared/limitePagamento.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) return new Response(JSON.stringify({ error: "Pagamento ainda não foi configurado. Fale com o suporte." }), { status: 503, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });

    const { data: profile } = await admin.from("profiles").select("org_id, role").eq("id", user.id).maybeSingle();
    if (!profile || !["admin", "socio"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Só admin ou sócio pode pagar a assinatura." }), { status: 403, headers: corsHeaders });
    }

    // Trava contra carding — achado real do qa-guardian: sem isso, chamadas repetidas com
    // card_token_id inválido testavam cartão roubado direto contra a API real do MP, sem
    // nenhum bloqueio (10/10 tentativas passaram no teste ao vivo).
    const bloqueio = await checarBloqueioPagamento(admin, profile.org_id);
    if (bloqueio) return new Response(JSON.stringify({ error: bloqueio }), { status: 429, headers: corsHeaders });

    const { plano, meses, brickData } = await req.json();
    const mesesNum = Number(meses);
    if (!plano || !mesesValidos(mesesNum) || !brickData?.token || !brickData?.payment_method_id) {
      return new Response(JSON.stringify({ error: "Escolha um plano, um período válido (3, 6 ou 12 meses) e preencha os dados do cartão." }), { status: 400, headers: corsHeaders });
    }

    // Preço vem do banco, nunca do que o client mandou. 'gratis' não é pagável.
    const { data: limite } = await admin.from("plan_limits").select("plano, valor_mensal").eq("plano", plano).maybeSingle();
    if (!limite || Number(limite.valor_mensal) <= 0) {
      return new Response(JSON.stringify({ error: "Plano inválido." }), { status: 400, headers: corsHeaders });
    }
    const valor = valorPagamentoAvulso(Number(limite.valor_mensal), mesesNum);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let pagamentoRes: Response;
    try {
      pagamentoRes = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "X-Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          transaction_amount: valor,
          token: brickData.token,
          payment_method_id: brickData.payment_method_id,
          issuer_id: brickData.issuer_id,
          installments: 1, // pré-pagamento de período, nunca parcelado
          description: `Actum — Plano ${limite.plano} (${mesesNum} meses via cartão, pagamento único)`,
          payer: { email: user.email, identification: brickData.payer?.identification },
          external_reference: profile.org_id,
          // underscore no VALOR é seguro (só a CHAVE do metadata é normalizada pelo Mercado
          // Pago na volta — ver comentário em mercado-pago-webhook), por isso tipo/meses/plano
          // como chave ficam sem underscore, mas o valor de "tipo" pode ter à vontade.
          metadata: { tipo: "actum_pagamento_cartao", meses: mesesNum, plano: limite.plano },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      const timedOut = (err as Error).name === "AbortError";
      return new Response(JSON.stringify({ error: timedOut ? "O Mercado Pago demorou demais pra responder. Tenta de novo." : `Falha ao cobrar o cartão: ${(err as Error).message}` }), { status: 504, headers: corsHeaders });
    } finally {
      clearTimeout(timeout);
    }
    const payment = await pagamentoRes.json().catch(() => null);
    // 'rejected' volta com HTTP 201 normal (não é erro HTTP) — contar como falha aqui também é
    // essencial pra trava de carding funcionar: um cartão roubado recusado NÃO pode resetar o
    // contador, senão a trava não protege nada.
    if (!pagamentoRes.ok || !payment?.id || payment.status === "rejected") {
      await registrarTentativaFalha(admin, profile.org_id);
      return new Response(JSON.stringify({ error: payment?.status_detail ?? payment?.message ?? "Não foi possível cobrar o cartão. Confira os dados." }), { status: 502, headers: corsHeaders });
    }
    await registrarTentativaSucesso(admin, profile.org_id);
    // status pode vir 'approved' (cartões de teste/alguns emissores respondem na hora) ou
    // 'in_process' (mais comum) — de qualquer forma, quem libera acesso de verdade é sempre o
    // webhook consultando a API, nunca essa resposta síncrona.
    return new Response(
      JSON.stringify({ ok: true, payment_id: payment.id, status: payment.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
