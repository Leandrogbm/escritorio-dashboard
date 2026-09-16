// Recebe a notificação do Mercado Pago e confirma pagamento no banco. A notificação nunca é
// confiada por si só: a função sempre consulta a API do Mercado Pago com o token privado
// antes de alterar organizations/platform_cobrancas.
//
// Eventos:
//   - "subscription_authorized_payment": pagamento de uma assinatura recorrente de cartão
//     (Payment Brick, mercado-pago-criar-assinatura) — libera a org e lança 1 platform_cobrancas
//     pro mês corrente (uma linha por vez, não 6 de uma vez como a atribuição manual de plano).
//     Assinatura anual (assinatura_ciclo='anual') chega aqui do mesmo jeito, como 1 pagamento
//     só do valor cheio do ano — vira 1 linha em platform_cobrancas também, não 12; o valor já
//     vem certo de payment.transaction_amount, não precisa saber o ciclo aqui pra isso.
//   - "subscription_preapproval": mudança de status da própria assinatura — só confirma e
//     registra, sem ação destrutiva (cancelamento de verdade é mercado-pago-cancelar-assinatura,
//     iniciado pelo próprio Actum; aqui é só acompanhar o que o Mercado Pago avisa).
//   - "payment": pagamento único (PIX pré-pago, mercado-pago-criar-pix — trilho separado do
//     cartão, sem token salvo pra cobrar de novo sozinho; também cobre o checkout avulso
//     legado, sem uso desde o modelo de trial por uso, mas mantido pra não deixar um pagamento
//     em trânsito antigo sem tratamento). `metadata.tipo` decide qual dos dois é.
//
// Nota: `metadata` do Mercado Pago às vezes normaliza chaves com underscore na volta — por
// isso a org sempre viaja em `external_reference` (campo top-level, nunca dentro de metadata),
// nunca em `metadata.org_id`. `metadata.tipo`/`metadata.meses`/`metadata.plano` não têm
// underscore, ficam seguros.
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

// Idempotente via mercado_pago_payment_id (unique) — reentrega do mesmo webhook não duplica.
async function jaProcessado(admin: ReturnType<typeof createClient>, paymentIdText: string) {
  const { data } = await admin.from("platform_cobrancas").select("id").eq("mercado_pago_payment_id", paymentIdText).maybeSingle();
  return !!data;
}

async function lancarCobranca(admin: ReturnType<typeof createClient>, orgId: string, valor: number, paymentIdText: string) {
  const mesReferencia = new Date();
  mesReferencia.setDate(1);
  const { error } = await admin
    .from("platform_cobrancas")
    .upsert(
      { org_id: orgId, mes_referencia: mesReferencia.toISOString().slice(0, 10), valor, status: "pago", mercado_pago_payment_id: paymentIdText },
      { onConflict: "org_id,mes_referencia" }
    );
  if (error) throw error;
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

      const paymentIdText = String(id);
      if (await jaProcessado(admin, paymentIdText)) return new Response("ok", { status: 200 });
      const { error: orgError } = await admin.from("organizations").update({ status_pagamento: "pago" }).eq("id", org.id);
      if (orgError) throw orgError;
      await lancarCobranca(admin, org.id, Number(payment.transaction_amount), paymentIdText);
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
      if (!orgId) return new Response("ignorado: pagamento sem organização de referência", { status: 200 });
      const { data: organization } = await admin.from("organizations").select("id").eq("id", orgId).maybeSingle();
      if (!organization) return new Response("ignorado: organização não encontrada", { status: 200 });

      const paymentIdText = String(id);
      if (await jaProcessado(admin, paymentIdText)) return new Response("ok", { status: 200 });

      if (payment.metadata?.tipo === "actum_pix_prepago") {
        // PIX é sempre pagamento único — não tem token salvo pra cobrar de novo sozinho.
        // "meses" pré-paga um período de acesso; quando pix_valido_ate vence, o cron
        // efetivar_cancelamentos_agendados bloqueia a org de novo (ver migração 20260915040000).
        const meses = Number(payment.metadata?.meses);
        const planoPix = String(payment.metadata?.plano ?? "");
        if (![3, 6, 12].includes(meses) || !planoPix) {
          return new Response("ignorado: metadata de PIX inválida", { status: 200 });
        }
        const { data: limite } = await admin.from("plan_limits").select("plano, valor_mensal").eq("plano", planoPix).maybeSingle();
        if (!limite) return new Response("ignorado: plano de PIX inválido", { status: 200 });

        const validoAte = new Date();
        validoAte.setMonth(validoAte.getMonth() + meses);
        const { error: orgError } = await admin
          .from("organizations")
          .update({
            plano: limite.plano,
            valor_mensal: limite.valor_mensal,
            status_pagamento: "pago",
            pix_valido_ate: validoAte.toISOString(),
          })
          .eq("id", orgId);
        if (orgError) throw orgError;
      } else if (payment.metadata?.tipo === "actum_assinatura") {
        // Checkout avulso legado — sem uso desde o modelo de trial por uso.
        const { error: orgError } = await admin.from("organizations").update({ status_pagamento: "pago" }).eq("id", orgId);
        if (orgError) throw orgError;
      } else {
        return new Response("ignorado: pagamento não pertence a nenhum fluxo Actum conhecido", { status: 200 });
      }

      await lancarCobranca(admin, orgId, Number(payment.transaction_amount), paymentIdText);
      return new Response("ok", { status: 200 });
    }

    return new Response("ignorado: tipo de notificação não tratado", { status: 200 });
  } catch (err) {
    return new Response(`erro: ${(err as Error).message}`, { status: 500 });
  }
});
