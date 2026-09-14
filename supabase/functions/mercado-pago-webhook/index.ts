// Recebe a notificação do Mercado Pago e libera a empresa quando o pagamento do
// checkout de cadastro for aprovado. A notificação não é confiada por si só: a função
// consulta o pagamento na API do Mercado Pago com o token privado antes de alterar o banco.
//
// Configuração:
//   supabase secrets set MERCADO_PAGO_ACCESS_TOKEN=<access-token-de-produção>
//   supabase functions deploy mercado-pago-webhook --no-verify-jwt
// Depois, cadastre a URL abaixo em Mercado Pago → Seus negócios → Webhooks:
//   https://<project-ref>.supabase.co/functions/v1/mercado-pago-webhook
// e habilite o evento "Pagamentos".

import { createClient } from "npm:@supabase/supabase-js@2";

function paymentIdFromNotification(body: Record<string, unknown>, url: URL) {
  const data = body?.data as { id?: string | number } | undefined;
  return data?.id ?? body?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
}

Deno.serve(async (req) => {
  try {
    // O Mercado Pago pode testar a URL por GET. A notificação real é POST.
    if (req.method === "GET") return new Response("ok", { status: 200 });
    if (req.method !== "POST") return new Response("método não permitido", { status: 405 });

    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) return new Response("integração não configurada", { status: 503 });

    const body = await req.json().catch(() => ({}));
    const paymentId = paymentIdFromNotification(body, new URL(req.url));
    if (!paymentId) return new Response("ignorado: sem id do pagamento", { status: 200 });

    // Consulta a fonte oficial antes de liberar o acesso. Assim uma chamada externa à URL
    // não basta para alterar pagamentos ou organizações.
    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!paymentRes.ok) return new Response("pagamento não encontrado", { status: 200 });
    const payment = await paymentRes.json();
    if (payment.status !== "approved") return new Response("ignorado: pagamento ainda não aprovado", { status: 200 });

    const orgId = payment.external_reference;
    if (!orgId || payment.metadata?.tipo !== "actum_assinatura") {
      return new Response("ignorado: pagamento não pertence a uma assinatura Actum", { status: 200 });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: organization } = await admin
      .from("organizations")
      .select("id")
      .eq("id", orgId)
      .maybeSingle();
    if (!organization) return new Response("ignorado: organização não encontrada", { status: 200 });

    const paymentIdText = String(paymentId);
    const { data: cobrancaJaProcessada } = await admin
      .from("platform_cobrancas")
      .select("id")
      .eq("mercado_pago_payment_id", paymentIdText)
      .maybeSingle();
    if (cobrancaJaProcessada) return new Response("ok", { status: 200 });

    const { error: orgError } = await admin
      .from("organizations")
      .update({ status_pagamento: "pago" })
      .eq("id", orgId);
    if (orgError) throw orgError;

    // A primeira cobrança pendente corresponde ao checkout inicial. Guardar o id do pagamento
    // torna reentregas do webhook idempotentes.
    const { data: cobranca } = await admin
      .from("platform_cobrancas")
      .select("id")
      .eq("org_id", orgId)
      .eq("status", "pendente")
      .order("mes_referencia", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (cobranca) {
      const { error: cobrancaError } = await admin.from("platform_cobrancas").update({ status: "pago", mercado_pago_payment_id: paymentIdText }).eq("id", cobranca.id);
      if (cobrancaError) throw cobrancaError;
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    return new Response(`erro: ${(err as Error).message}`, { status: 500 });
  }
});
