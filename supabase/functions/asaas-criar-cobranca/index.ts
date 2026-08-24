// Gera uma cobrança de verdade na Asaas (boleto + Pix + cartão, cliente escolhe) pra um
// honorário já cadastrado — devolve o link de pagamento pra mandar ao cliente. Cria o
// "customer" na Asaas na primeira vez (cacheia o id em clientes.asaas_customer_id) e a
// cobrança em si (cacheia em honorarios.asaas_charge_id/asaas_invoice_url). Quando o Asaas
// avisar que foi pago (asaas-webhook), o honorário vira "Pago" sozinho.
//
// Deploy: supabase functions deploy asaas-criar-cobranca
// Credencial: por organização (organizations.asaas_token/asaas_ambiente), colada em
// Configurações → Cobrança automática — não é secret global, cada escritório usa a própria conta.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function baseUrl(ambiente: string) {
  return ambiente === "producao" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });
    }
    const { data: callerProfile } = await admin.from("profiles").select("org_id").eq("id", caller.id).single();
    const { data: platformAdminRow } = await admin.from("platform_admins").select("user_id").eq("user_id", caller.id).maybeSingle();
    const ehPlatformAdmin = !!platformAdminRow;
    if (!ehPlatformAdmin && !callerProfile) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });
    }

    const { honorarioId } = await req.json();
    if (!honorarioId) {
      return new Response(JSON.stringify({ error: "honorarioId é obrigatório." }), { status: 400, headers: corsHeaders });
    }

    const { data: honorario } = await admin.from("honorarios").select("*, cliente:clientes(*)").eq("id", honorarioId).single();
    if (!honorario) {
      return new Response(JSON.stringify({ error: "Cobrança não encontrada." }), { status: 404, headers: corsHeaders });
    }
    if (!ehPlatformAdmin && honorario.org_id !== callerProfile.org_id) {
      return new Response(JSON.stringify({ error: "Cobrança não encontrada." }), { status: 404, headers: corsHeaders });
    }
    if (honorario.asaas_charge_id) {
      return new Response(JSON.stringify({ ok: true, invoiceUrl: honorario.asaas_invoice_url, jaExistia: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: org } = await admin.from("organizations").select("asaas_token, asaas_ambiente").eq("id", honorario.org_id).single();
    if (!org?.asaas_token) {
      return new Response(JSON.stringify({ error: "Cobrança automática ainda não foi configurada (falta conectar a conta Asaas em Configurações)." }), { status: 400, headers: corsHeaders });
    }
    const api = baseUrl(org.asaas_ambiente);
    const headers = { "Content-Type": "application/json", access_token: org.asaas_token };

    let asaasCustomerId = honorario.cliente?.asaas_customer_id;
    if (!asaasCustomerId) {
      const cliente = honorario.cliente;
      if (!cliente?.documento) {
        return new Response(JSON.stringify({ error: "Esse cliente não tem CPF/CNPJ cadastrado — a Asaas exige documento pra criar a cobrança." }), { status: 400, headers: corsHeaders });
      }
      const custRes = await fetch(`${api}/customers`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: cliente.nome, cpfCnpj: cliente.documento.replace(/\D/g, ""), email: cliente.email || undefined, mobilePhone: cliente.celular || undefined }),
      });
      const custBody = await custRes.json();
      if (!custRes.ok) {
        return new Response(JSON.stringify({ error: `Falha ao cadastrar cliente na Asaas: ${custBody.errors?.[0]?.description ?? JSON.stringify(custBody)}` }), { status: 502, headers: corsHeaders });
      }
      asaasCustomerId = custBody.id;
      await admin.from("clientes").update({ asaas_customer_id: asaasCustomerId }).eq("id", cliente.id);
    }

    const paymentRes = await fetch(`${api}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: "UNDEFINED", // deixa o cliente escolher Pix/boleto/cartão na hora de pagar
        value: Number(honorario.valor),
        dueDate: honorario.vencimento,
        description: honorario.descricao_servico || `Honorário — ${honorario.cliente?.nome ?? ""}`,
      }),
    });
    const paymentBody = await paymentRes.json();
    if (!paymentRes.ok) {
      return new Response(JSON.stringify({ error: `Falha ao gerar cobrança na Asaas: ${paymentBody.errors?.[0]?.description ?? JSON.stringify(paymentBody)}` }), { status: 502, headers: corsHeaders });
    }

    await admin.from("honorarios").update({ asaas_charge_id: paymentBody.id, asaas_invoice_url: paymentBody.invoiceUrl }).eq("id", honorarioId);

    return new Response(JSON.stringify({ ok: true, invoiceUrl: paymentBody.invoiceUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
