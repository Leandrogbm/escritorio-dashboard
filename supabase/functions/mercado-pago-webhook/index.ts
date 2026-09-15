// Recebe a notificação do Mercado Pago e confirma pagamento no banco. A notificação nunca é
// confiada por si só: a função sempre consulta a API do Mercado Pago com o token privado
// antes de alterar organizations/platform_cobrancas.
//
// Dois eventos:
//   - "subscription_authorized_payment": pagamento de uma assinatura recorrente (Payment
//     Brick, mercado-pago-criar-assinatura) — libera a org e lança 1 platform_cobrancas pro
//     mês corrente (uma linha por vez, não 6 de uma vez como a atribuição manual de plano).
//     Assinatura anual (assinatura_ciclo='anual') chega aqui do mesmo jeito, como 1 pagamento
//     só do valor cheio do ano — vira 1 linha em platform_cobrancas também, não 12; o valor já
//     vem certo de payment.transaction_amount, não precisa saber o ciclo aqui pra isso.
//   - "subscription_preapproval": mudança de status da própria assinatura — só confirma e
//     registra, sem ação destrutiva (cancelamento de verdade é mercado-pago-cancelar-assinatura,
//     iniciado pelo próprio Actum; aqui é só acompanhar o que o Mercado Pago avisa).
//   - "payment": checkout avulso (legado — sem uso desde o modelo de trial por uso, mas
//     mantido pra não deixar um pagamento em trânsito antigo sem tratamento).
//
// Configuração:
//   supabase secrets set MERCADO_PAGO_ACCESS_TOKEN=<access-token-de-produção>
//   supabase functions deploy mercado-pago-webhook --no-verify-jwt
// Depois, cadastre a URL abaixo em Mercado Pago → Seus negócios → Webhooks:
//   https://<project-ref>.supabase.co/functions/v1/mercado-pago-webhook
// e habilite os eventos "Pagamentos" e "Assinaturas".

import { createClient } from "npm:@supabase/supabase-js@2";

function notificationId(body: Record<string, unknown>, url: URL) {
  const data = body?.data as { id?: string | number } | undefined;
  return data?.id ?? body?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
}

// Lança/atualiza 1 cobrança do mês corrente e marca a org como paga — idempotente via
// mercado_pago_payment_id (mesma defesa que o pagamento avulso já usava).
async function confirmarCobrancaMes(admin: ReturnType<typeof createClient>, orgId: string, valor: number, paymentIdText: string) {
  const { data: jaProcessada } = await admin
    .from("platform_cobrancas")
    .select("id")
    .eq("mercado_pago_payment_id", paymentIdText)
    .maybeSingle();
  if (jaProcessada) return;

  const { error: orgError } = await admin.from("organizations").update({ status_pagamento: "pago" }).eq("id", orgId);
  if (orgError) throw orgError;

  const mesReferencia = new Date();
  mesReferencia.setDate(1);
  const { error: cobrancaError } = await admin
    .from("platform_cobrancas")
    .upsert(
      { org_id: orgId, mes_referencia: mesReferencia.toISOString().slice(0, 10), valor, status: "pago", mercado_pago_payment_id: paymentIdText },
      { onConflict: "org_id,mes_referencia" }
    );
  if (cobrancaError) throw cobrancaError;
}

Deno.serve(async (req) => {
  try {
    // O Mercado Pago pode testar a URL por GET. A notificação real é POST.
    if (req.method === "GET") return new Response("ok", { status: 200 });
    if (req.method !== "POST") return new Response("método não permitido", { status: 405 });

    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) return new Response("integração não configurada", { status: 503 });

    const body = await req.json().catch(() => ({}));
    const tipo = (body?.type as string) ?? new URL(req.url).searchParams.get("type");
    const id = notificationId(body, new URL(req.url));
    if (!id) return new Response("ignorado: sem id na notificação", { status: 200 });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (tipo === "subscription_authorized_payment") {
      const res = await fetch(`https://api.mercadopago.com/authorized_payments/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return new Response("pagamento de assinatura não encontrado", { status: 200 });
      const payment = await res.json();
      if (payment.status !== "processed") return new Response("ignorado: pagamento de assinatura ainda não processado", { status: 200 });

      const { data: org } = await admin
        .from("organizations")
        .select("id")
        .eq("mercado_pago_subscription_id", payment.preapproval_id)
        .maybeSingle();
      if (!org) return new Response("ignorado: assinatura não pertence a nenhuma organização", { status: 200 });

      await confirmarCobrancaMes(admin, org.id, Number(payment.transaction_amount), String(id));
      return new Response("ok", { status: 200 });
    }

    if (tipo === "subscription_preapproval") {
      // Só confirma na fonte oficial e loga — cancelamento de verdade sempre parte do Actum
      // (mercado-pago-cancelar-assinatura), não deste webhook.
      const res = await fetch(`https://api.mercadopago.com/preapproval/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return new Response("assinatura não encontrada", { status: 200 });
      const preapproval = await res.json();
      console.log(`subscription_preapproval id=${id} status=${preapproval.status} external_reference=${preapproval.external_reference}`);
      return new Response("ok", { status: 200 });
    }

    if (tipo === "payment" || !tipo) {
      // Consulta a fonte oficial antes de liberar o acesso. Assim uma chamada externa à URL
      // não basta para alterar pagamentos ou organizações.
      const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!paymentRes.ok) return new Response("pagamento não encontrado", { status: 200 });
      const payment = await paymentRes.json();
      if (payment.status !== "approved") return new Response("ignorado: pagamento ainda não aprovado", { status: 200 });

      const orgId = payment.external_reference;
      if (!orgId || payment.metadata?.tipo !== "actum_assinatura") {
        return new Response("ignorado: pagamento não pertence a uma assinatura Actum", { status: 200 });
      }
      const { data: organization } = await admin.from("organizations").select("id").eq("id", orgId).maybeSingle();
      if (!organization) return new Response("ignorado: organização não encontrada", { status: 200 });

      await confirmarCobrancaMes(admin, orgId, Number(payment.transaction_amount), String(id));
      return new Response("ok", { status: 200 });
    }

    return new Response("ignorado: tipo de notificação não tratado", { status: 200 });
  } catch (err) {
    return new Response(`erro: ${(err as Error).message}`, { status: 500 });
  }
});
