// Gera uma chave de API pra integração externa (ERP/CRM) — a chave em texto puro só existe
// nesta resposta, uma vez; o banco guarda só o hash (sha256). Só admin/sócio da própria
// empresa, ou o platform admin.
//
// Deploy: supabase functions deploy api-keys-create

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(texto: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
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

    const { data: callerProfile } = await admin.from("profiles").select("org_id, role").eq("id", caller.id).single();
    const { data: platformAdminRow } = await admin.from("platform_admins").select("user_id").eq("user_id", caller.id).maybeSingle();
    const ehPlatformAdmin = !!platformAdminRow;
    const ehAdminOuSocioDaOrg = callerProfile && ["admin", "socio"].includes(callerProfile.role);
    if (!ehPlatformAdmin && !ehAdminOuSocioDaOrg) {
      return new Response(JSON.stringify({ error: "Só admin ou sócio podem gerar chave de API." }), { status: 403, headers: corsHeaders });
    }

    const { nome, orgId } = await req.json();
    if (!nome) {
      return new Response(JSON.stringify({ error: "nome é obrigatório." }), { status: 400, headers: corsHeaders });
    }
    const targetOrgId = ehPlatformAdmin && orgId ? orgId : callerProfile?.org_id;
    if (!targetOrgId) {
      return new Response(JSON.stringify({ error: "Empresa alvo não identificada." }), { status: 400, headers: corsHeaders });
    }

    const chave = `sk_live_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
    const hash = await sha256Hex(chave);

    const { error: insertErr } = await admin.from("api_keys").insert({
      org_id: targetOrgId,
      nome,
      key_hash: hash,
      key_prefix: chave.slice(0, 12),
    });
    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true, chave }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
