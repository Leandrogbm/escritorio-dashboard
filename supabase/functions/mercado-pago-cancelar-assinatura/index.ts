// Cancela a assinatura recorrente da própria empresa. Duas regras, valem JUNTAS:
//   1. Fidelidade mínima de 3 meses desde assinatura_iniciada_em — antes disso, recusa com a
//      data em que dá pra cancelar. Sem multa cobrada automaticamente por enquanto.
//   2. Depois da fidelidade, cancelar NUNCA desfaz o ciclo já pago: pára de cobrar no Mercado
//      Pago na hora (PUT status=cancelled), mas só marca cancelamento_agendado_para (fim do
//      ciclo corrente — fim do MÊS pra assinatura mensal, fim do ANO pago pra assinatura
//      anual, ver assinatura_ciclo) — o downgrade de verdade pro plano grátis só acontece
//      nessa data (cron efetivar_cancelamentos_agendados, 1x/dia). Acesso continua normal até
//      lá, sem reembolso em nenhum caso.
// ponytail: multa por cancelamento antes da fidelidade é upgrade futuro (cobrança avulsa
// extra via /v1/payments) — não dá pra testar isso em produção real com segurança agora,
// então só bloqueia o cancelamento em vez de tentar cobrar algo não testado.
//
// Só existe pra quem tem mercado_pago_subscription_id preenchido (assinatura recorrente de
// verdade). Pagamento pré-pago (PIX ou cartão avulso, mercado-pago-criar-pix/
// mercado-pago-criar-pagamento-cartao) NUNCA seta essa coluna — "não cancelável" já é
// automático (já foi cobrado o valor total, sem como devolver parcial): o erro abaixo
// ("Não há assinatura ativa") é o que essas contas sempre recebem, de propósito.
//
// Deploy: supabase functions deploy mercado-pago-cancelar-assinatura
// Secret necessário: supabase secrets set MERCADO_PAGO_ACCESS_TOKEN=<access-token-de-produção>

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      return new Response(JSON.stringify({ error: "Só admin ou sócio pode cancelar a assinatura." }), { status: 403, headers: corsHeaders });
    }

    const { data: org } = await admin
      .from("organizations")
      .select("mercado_pago_subscription_id, assinatura_iniciada_em, cancelamento_agendado_para, assinatura_ciclo")
      .eq("id", profile.org_id)
      .maybeSingle();
    if (!org?.mercado_pago_subscription_id) {
      return new Response(JSON.stringify({ error: "Não há assinatura ativa para cancelar." }), { status: 400, headers: corsHeaders });
    }

    // Fidelidade de 3 meses é sempre o piso absoluto, mesmo cálculo pros dois ciclos — quem
    // assina anual já passa disso naturalmente (o ciclo pago dele dura 1 ano inteiro).
    const liberadoEm = new Date(org.assinatura_iniciada_em!);
    liberadoEm.setMonth(liberadoEm.getMonth() + 3);
    if (new Date() < liberadoEm) {
      const dataFormatada = liberadoEm.toLocaleDateString("pt-BR");
      return new Response(
        JSON.stringify({ error: `A assinatura tem fidelidade mínima de 3 meses. Só é possível cancelar a partir de ${dataFormatada}.` }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Ciclo corrente já pago fica garantido até o fim, nunca desfeito. Mensal: fim do mês
    // calendário atual (mesmo alinhamento de platform_cobrancas.mes_referencia). Anual: fim do
    // ANO pago — o próximo aniversário de assinatura_iniciada_em ainda não alcançado, não o
    // fim do mês (uma assinatura anual de 8 meses atrás ainda tem 4 meses pagos pela frente).
    const agora = new Date();
    let fimCicloAtual: Date;
    if (org.assinatura_ciclo === "anual") {
      fimCicloAtual = new Date(org.assinatura_iniciada_em!);
      while (fimCicloAtual <= agora) fimCicloAtual.setFullYear(fimCicloAtual.getFullYear() + 1);
    } else {
      fimCicloAtual = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
    }

    // Idempotente: já tinha cancelamento agendado, não chama o Mercado Pago de novo.
    if (org.cancelamento_agendado_para) {
      return new Response(
        JSON.stringify({ ok: true, message: `Cancelamento já estava agendado para ${new Date(org.cancelamento_agendado_para).toLocaleDateString("pt-BR")}.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let cancelRes: Response;
    try {
      cancelRes = await fetch(`https://api.mercadopago.com/preapproval/${org.mercado_pago_subscription_id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
        signal: controller.signal,
      });
    } catch (err) {
      const timedOut = (err as Error).name === "AbortError";
      return new Response(JSON.stringify({ error: timedOut ? "O Mercado Pago demorou demais pra responder. Tenta de novo." : `Falha ao cancelar: ${(err as Error).message}` }), { status: 504, headers: corsHeaders });
    } finally {
      clearTimeout(timeout);
    }
    if (!cancelRes.ok) {
      const body = await cancelRes.json().catch(() => null);
      return new Response(JSON.stringify({ error: body?.message ?? "Não foi possível cancelar a assinatura no Mercado Pago." }), { status: 502, headers: corsHeaders });
    }

    // Não desce pro grátis agora — só agenda. efetivar_cancelamentos_agendados (cron diário)
    // faz o downgrade de verdade quando o ciclo já pago terminar.
    const { error: updateError } = await admin
      .from("organizations")
      .update({ cancelamento_agendado_para: fimCicloAtual.toISOString() })
      .eq("id", profile.org_id);
    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ ok: true, message: `Assinatura cancelada — não cobra de novo. Acesso ao plano pago continua até ${fimCicloAtual.toLocaleDateString("pt-BR")}, depois volta pro grátis.` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
