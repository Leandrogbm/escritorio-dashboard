// Busca processo novo pra cada OAB monitorada (oabs_monitoradas) via Jusbrasil Soluções, e
// grava em processos_descobertos os CNJs que ainda não estão nem lá nem em `processos`.
// Dois jeitos de chamar, mesmo padrão do datajud-sync: cron (x-cron-secret, todas as
// empresas) ou usuário autenticado (botão "Sincronizar agora", só a própria empresa).
//
// ATENÇÃO: construído a partir da documentação oficial (api.jusbrasil.com.br/docs/oab), sem
// teste contra conta real.
//
// Deploy: supabase functions deploy jusbrasil-sync --no-verify-jwt
// Secret: JUSBRASIL_CRON_SECRET (string aleatória sua, pro cron chamar sem JWT de usuário)

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function soDigitos(s: string) {
  return (s || "").replace(/\D/g, "");
}

async function sincronizarOrg(admin: ReturnType<typeof createClient>, orgId: string) {
  const { data: org } = await admin.from("organizations").select("jusbrasil_token").eq("id", orgId).single();
  if (!org?.jusbrasil_token) return { orgId, pulado: "sem token configurado" };

  const { data: oabs } = await admin.from("oabs_monitoradas").select("id, correlation_id").eq("org_id", orgId);
  const { data: processosExistentes } = await admin.from("processos").select("numero").eq("org_id", orgId);
  const numerosExistentes = new Set((processosExistentes ?? []).map((p: { numero: string }) => soDigitos(p.numero)));

  let novos = 0;
  for (const oab of oabs ?? []) {
    if (!oab.correlation_id) continue;
    const res = await fetch(
      `https://op.digesto.com.br/api/monitoramento/oab/vinculos/processos/oab?correlation_id=${oab.correlation_id}&per_page=100&page=1`,
      { headers: { Authorization: `Bearer ${org.jusbrasil_token}`, Accept: "application/json" } }
    );
    if (!res.ok) continue;
    const vinculos = await res.json().catch(() => []);
    for (const v of Array.isArray(vinculos) ? vinculos : []) {
      const cnj = soDigitos(v.cnj ?? "");
      if (!cnj || numerosExistentes.has(cnj)) continue;
      const { error } = await admin.from("processos_descobertos").insert({
        org_id: orgId, oab_monitorada_id: oab.id, numero_cnj: cnj,
      });
      if (!error) novos++; // erro aqui normalmente é duplicata (unique org_id+numero_cnj), ignora
    }
  }
  return { orgId, novos };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const cronSecret = req.headers.get("x-cron-secret");
    const ehCron = cronSecret && cronSecret === Deno.env.get("JUSBRASIL_CRON_SECRET");

    let orgIds: string[];
    if (ehCron) {
      const { data: orgs } = await admin.from("organizations").select("id").not("jusbrasil_token", "is", null);
      orgIds = (orgs ?? []).map((o: { id: string }) => o.id);
    } else {
      const authHeader = req.headers.get("Authorization") ?? "";
      const { data: { user: caller }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
      if (authErr || !caller) return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });
      const { data: callerProfile } = await admin.from("profiles").select("org_id").eq("id", caller.id).single();
      if (!callerProfile) return new Response(JSON.stringify({ error: "Perfil não encontrado." }), { status: 404, headers: corsHeaders });
      orgIds = [callerProfile.org_id];
    }

    const resultados = [];
    for (const orgId of orgIds) resultados.push(await sincronizarOrg(admin, orgId));

    return new Response(JSON.stringify({ ok: true, resultados }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
