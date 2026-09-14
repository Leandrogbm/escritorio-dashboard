// Recupera o checkout de uma empresa pendente quando ela foi criada antes da
// persistência do link estar disponível. Exige a sessão do próprio administrador.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });

    const { data: profile } = await admin.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
    if (!profile) return new Response(JSON.stringify({ error: "Conta sem empresa vinculada." }), { status: 403, headers: corsHeaders });

    const { data: org } = await admin
      .from("organizations")
      .select("id, nome, plano, valor_mensal, status_pagamento, mercado_pago_checkout_url")
      .eq("id", profile.org_id)
      .maybeSingle();
    if (!org?.plano || org.status_pagamento === "pago") {
      return new Response(JSON.stringify({ error: "Não há pagamento pendente para esta conta." }), { status: 400, headers: corsHeaders });
    }
    if (org.mercado_pago_checkout_url) {
      return new Response(JSON.stringify({ checkoutUrl: org.mercado_pago_checkout_url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) return new Response(JSON.stringify({ error: "Checkout não configurado." }), { status: 503, headers: corsHeaders });

    const preferenceRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ title: `Actum — Plano ${org.plano}`, quantity: 1, currency_id: "BRL", unit_price: Number(org.valor_mensal) }],
        payer: { email: user.email },
        external_reference: org.id,
        metadata: { tipo: "actum_assinatura", org_id: org.id },
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercado-pago-webhook`,
      }),
    });
    const preference = await preferenceRes.json().catch(() => null);
    if (!preferenceRes.ok || !preference?.init_point) {
      return new Response(JSON.stringify({ error: "Não foi possível gerar o checkout." }), { status: 502, headers: corsHeaders });
    }

    const { error: updateError } = await admin
      .from("organizations")
      .update({ mercado_pago_checkout_url: preference.init_point })
      .eq("id", org.id);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ checkoutUrl: preference.init_point }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
