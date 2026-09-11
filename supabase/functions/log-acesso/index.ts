// Registra 1 linha de acesso (usuário, empresa, página, IP) em access_log — usado pelo painel
// da plataforma ("quantos acessos, em quais páginas, quanto tempo logado, qual IP"). IP real só
// dá pra pegar no header da requisição (não no navegador), por isso isso não é um insert direto
// do client: usa service role e ignora silenciosamente qualquer erro (não pode travar o app).
//
// Deploy: supabase functions deploy log-acesso --no-verify-jwt
// (--no-verify-jwt porque a função valida o JWT ela mesma via auth.getUser, igual as outras)

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

    const { data: { user }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });
    }

    const { pagina, orgIdSuporte } = await req.json();
    if (!pagina || typeof pagina !== "string") {
      return new Response(JSON.stringify({ error: "pagina é obrigatória." }), { status: 400, headers: corsHeaders });
    }

    const { data: profile } = await admin.from("profiles").select("org_id").eq("id", user.id).maybeSingle();

    // orgIdSuporte é a empresa que um platform admin está visitando em "modo suporte" — só
    // confia nisso vindo de quem é platform admin de verdade, senão um usuário comum poderia
    // atribuir o próprio acesso a uma empresa qualquer.
    let orgId = profile?.org_id ?? null;
    if (orgIdSuporte) {
      const { data: platformAdminRow } = await admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
      if (platformAdminRow) orgId = orgIdSuporte;
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("cf-connecting-ip")
      ?? "desconhecido";

    await admin.from("access_log").insert({
      user_id: user.id,
      org_id: orgId,
      pagina: pagina.slice(0, 100),
      ip,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    // Log de acesso é telemetria, não pode derrubar o app nem virar alerta de erro — engole.
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), { status: 200, headers: corsHeaders });
  }
});
