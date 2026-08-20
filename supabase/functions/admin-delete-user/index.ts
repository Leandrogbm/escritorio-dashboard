// Exclui um colaborador: apaga o Auth user (cascade cuida do profile). Só admin ou sócio
// podem chamar, e só dentro da própria org — roda com service_role pelo mesmo motivo de
// admin-create-user (deleteUser não existe no client com anon key).
//
// Deploy: supabase functions deploy admin-delete-user

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

    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });
    }

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("org_id, role")
      .eq("id", caller.id)
      .single();
    const { data: platformAdminRow } = await admin.from("platform_admins").select("user_id").eq("user_id", caller.id).maybeSingle();
    const ehPlatformAdmin = !!platformAdminRow;
    const ehAdminOuSocioDaOrg = callerProfile && ["admin", "socio"].includes(callerProfile.role);
    if (!ehPlatformAdmin && !ehAdminOuSocioDaOrg) {
      return new Response(JSON.stringify({ error: "Só admin, sócio ou o admin da plataforma podem excluir colaborador." }), { status: 403, headers: corsHeaders });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId é obrigatório." }), { status: 400, headers: corsHeaders });
    }
    if (userId === caller.id) {
      return new Response(JSON.stringify({ error: "Você não pode excluir sua própria conta por aqui." }), { status: 400, headers: corsHeaders });
    }

    // admin/sócio só excluem dentro da própria org — platform admin pula essa checagem,
    // pode mirar qualquer colaborador de qualquer empresa.
    if (!ehPlatformAdmin) {
      const { data: targetProfile } = await admin.from("profiles").select("org_id, role").eq("id", userId).single();
      if (!targetProfile || targetProfile.org_id !== callerProfile.org_id) {
        return new Response(JSON.stringify({ error: "Colaborador não encontrado." }), { status: 404, headers: corsHeaders });
      }
      // sócio pode excluir qualquer um (menos admin); admin exclui todo mundo, sócio incluso.
      if (callerProfile.role === "socio" && targetProfile.role === "admin") {
        return new Response(JSON.stringify({ error: "Sócio não pode excluir o admin." }), { status: 403, headers: corsHeaders });
      }
    }

    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteErr) {
      return new Response(JSON.stringify({ error: deleteErr.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
