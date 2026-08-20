// Troca o email de login de um colaborador — mexe em auth.users, precisa de service_role
// (não dá pra fazer do client com a anon key). Só admin/sócio da mesma empresa do alvo,
// ou o platform admin mirando qualquer empresa.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });
    }

    const { data: callerProfile } = await admin.from("profiles").select("org_id, role").eq("id", caller.id).single();
    const { data: platformAdminRow } = await admin.from("platform_admins").select("user_id").eq("user_id", caller.id).maybeSingle();
    const ehPlatformAdmin = !!platformAdminRow;
    const ehAdminOuSocioDaOrg = callerProfile && ["admin", "socio"].includes(callerProfile.role);
    if (!ehPlatformAdmin && !ehAdminOuSocioDaOrg) {
      return new Response(JSON.stringify({ error: "Só admin, sócio ou o admin da plataforma podem alterar o email." }), { status: 403, headers: corsHeaders });
    }

    const { userId, email } = await req.json();
    if (!userId || !email) {
      return new Response(JSON.stringify({ error: "userId e email são obrigatórios." }), { status: 400, headers: corsHeaders });
    }

    if (!ehPlatformAdmin) {
      const { data: targetProfile } = await admin.from("profiles").select("org_id").eq("id", userId).single();
      if (!targetProfile || targetProfile.org_id !== callerProfile.org_id) {
        return new Response(JSON.stringify({ error: "Colaborador não encontrado." }), { status: 404, headers: corsHeaders });
      }
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
