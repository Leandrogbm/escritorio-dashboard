// Registra uma OAB pra monitoramento no Jusbrasil Soluções — usa a credencial DA PRÓPRIA
// EMPRESA (organizations.jusbrasil_token), não uma chave compartilhada da plataforma.
//
// ATENÇÃO: construído a partir da documentação oficial (api.jusbrasil.com.br/docs/oab),
// sem teste contra conta real (não temos credencial de teste, e o módulo de OAB do Jusbrasil
// exige contato comercial pra habilitar).
//
// Deploy: supabase functions deploy jusbrasil-monitorar-oab

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (!ehPlatformAdmin && !(callerProfile && ["admin", "socio"].includes(callerProfile.role))) {
      return new Response(JSON.stringify({ error: "Só admin ou sócio podem cadastrar OAB pra monitorar." }), { status: 403, headers: corsHeaders });
    }

    const { nome, numero, uf, orgId } = await req.json();
    if (!nome || !numero || !uf) {
      return new Response(JSON.stringify({ error: "nome, numero e uf são obrigatórios." }), { status: 400, headers: corsHeaders });
    }
    const targetOrgId = ehPlatformAdmin && orgId ? orgId : callerProfile?.org_id;

    const { data: org } = await admin.from("organizations").select("jusbrasil_token").eq("id", targetOrgId).single();
    if (!org?.jusbrasil_token) {
      return new Response(JSON.stringify({ error: "Configure o token do Jusbrasil da empresa em Configurações antes de monitorar uma OAB." }), { status: 400, headers: corsHeaders });
    }

    const res = await fetch("https://op.digesto.com.br/api/monitoramento/oab/acompanhamento/", {
      method: "POST",
      headers: { Authorization: `Bearer ${org.jusbrasil_token}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ name: nome, number: Number(numero), region: uf, is_active: true }]),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Jusbrasil recusou: ${JSON.stringify(body)}` }), { status: 400, headers: corsHeaders });
    }
    const item = Array.isArray(body) ? body[0] : body;

    const { error: insertErr } = await admin.from("oabs_monitoradas").insert({
      org_id: targetOrgId,
      nome_advogado: nome,
      numero_oab: Number(numero),
      uf_oab: uf,
      jusbrasil_oab_id: item?.id ?? null,
      correlation_id: item?.correlation_id ?? null,
    });
    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
