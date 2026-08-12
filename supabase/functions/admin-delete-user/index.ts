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
    if (!callerProfile || !["admin", "socio"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Só admin ou sócio podem excluir colaborador." }), { status: 403, headers: corsHeaders });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId é obrigatório." }), { status: 400, headers: corsHeaders });
    }
    if (userId === caller.id) {
      return new Response(JSON.stringify({ error: "Você não pode excluir sua própria conta por aqui." }), { status: 400, headers: corsHeaders });
    }

    // confirma que o alvo é da mesma org antes de apagar — não dá pra um admin de uma
    // empresa excluir colaborador de outra só adivinhando o id.
    const { data: targetProfile } = await admin.from("profiles").select("org_id").eq("id", userId).single();
    if (!targetProfile || targetProfile.org_id !== callerProfile.org_id) {
      return new Response(JSON.stringify({ error: "Colaborador não encontrado." }), { status: 404, headers: corsHeaders });
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
