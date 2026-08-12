// Exclui uma empresa (organization) por completo: todos os honorarios, processos (cascade
// cuida dos prazos), clientes, role_permissions, os logins de todos os colaboradores
// (auth users — cascade cuida dos profiles) e a organization em si. Irreversível, só
// platform admin chama. Ordem importa por causa das FKs (ver comentário em cada bloco).
//
// Deploy: supabase functions deploy platform-delete-org

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

    // service_role ignora RLS — checa direto na tabela (mesma lógica de is_platform_admin())
    const { data: platformAdminRow } = await admin.from("platform_admins").select("user_id").eq("user_id", caller.id).maybeSingle();
    if (!platformAdminRow) {
      return new Response(JSON.stringify({ error: "Só o admin da plataforma pode excluir uma empresa." }), { status: 403, headers: corsHeaders });
    }

    const { orgId, confirmarNome } = await req.json();
    if (!orgId) {
      return new Response(JSON.stringify({ error: "orgId é obrigatório." }), { status: 400, headers: corsHeaders });
    }

    const { data: org } = await admin.from("organizations").select("nome").eq("id", orgId).single();
    if (!org) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada." }), { status: 404, headers: corsHeaders });
    }
    if (confirmarNome !== org.nome) {
      return new Response(JSON.stringify({ error: "Nome de confirmação não confere." }), { status: 400, headers: corsHeaders });
    }

    // ordem: honorarios/processos (que dependem de clientes e profiles) antes de clientes
    // e profiles; profiles por último entre as tabelas de negócio, via exclusão do Auth
    // user (cascade cuida da linha em profiles sozinho).
    await admin.from("honorarios").delete().eq("org_id", orgId);
    await admin.from("processos").delete().eq("org_id", orgId); // cascade cuida de prazos
    await admin.from("clientes").delete().eq("org_id", orgId);
    await admin.from("role_permissions").delete().eq("org_id", orgId);

    const { data: membros } = await admin.from("profiles").select("id").eq("org_id", orgId);
    for (const m of membros ?? []) {
      await admin.auth.admin.deleteUser(m.id);
    }

    const { error: orgDelErr } = await admin.from("organizations").delete().eq("id", orgId);
    if (orgDelErr) {
      return new Response(JSON.stringify({ error: orgDelErr.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
