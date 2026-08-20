// Redefine a senha de um colaborador: gera uma senha temporária nova, grava no Auth (mexe
// em auth.users, precisa de service_role) e manda por email via Resend. Mesma regra de quem
// pode mexer no colaborador que admin-update-email: admin/sócio da própria empresa, ou o
// platform admin mirando qualquer empresa.
//
// Deploy: supabase functions deploy admin-reset-password
// Secret necessário: RESEND_API_KEY (mesmo usado por admin-create-user)

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function gerarSenhaTemporaria() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

async function enviarSenhaPorEmail(email: string, nome: string, senha: string, orgNome: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${orgNome} <nao-responda@mysaldo.com.br>`,
      to: email,
      subject: `Nova senha — ${orgNome}`,
      text: `Olá, ${nome}!\n\nSua senha de acesso ao Dashboard foi redefinida.\nNova senha temporária: ${senha}\n\nTroque a senha no primeiro acesso.`,
    }),
  });
  if (!res.ok) throw new Error(`Falha ao enviar email: ${await res.text()}`);
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

    const { data: callerProfile } = await admin.from("profiles").select("org_id, role, organizations(nome)").eq("id", caller.id).single();
    const { data: platformAdminRow } = await admin.from("platform_admins").select("user_id").eq("user_id", caller.id).maybeSingle();
    const ehPlatformAdmin = !!platformAdminRow;
    const ehAdminOuSocioDaOrg = callerProfile && ["admin", "socio"].includes(callerProfile.role);
    if (!ehPlatformAdmin && !ehAdminOuSocioDaOrg) {
      return new Response(JSON.stringify({ error: "Só admin, sócio ou o admin da plataforma podem redefinir senha." }), { status: 403, headers: corsHeaders });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId é obrigatório." }), { status: 400, headers: corsHeaders });
    }

    const { data: targetProfile } = await admin.from("profiles").select("org_id, role, nome, organizations(nome)").eq("id", userId).single();
    if (!targetProfile) {
      return new Response(JSON.stringify({ error: "Colaborador não encontrado." }), { status: 404, headers: corsHeaders });
    }
    if (!ehPlatformAdmin) {
      if (targetProfile.org_id !== callerProfile.org_id) {
        return new Response(JSON.stringify({ error: "Colaborador não encontrado." }), { status: 404, headers: corsHeaders });
      }
      // mesma regra de admin-delete-user: sócio não mexe na conta do admin.
      if (callerProfile.role === "socio" && targetProfile.role === "admin") {
        return new Response(JSON.stringify({ error: "Sócio não pode redefinir a senha do admin." }), { status: 403, headers: corsHeaders });
      }
    }

    const { data: authUser, error: getErr } = await admin.auth.admin.getUserById(userId);
    if (getErr || !authUser?.user?.email) {
      return new Response(JSON.stringify({ error: "Não achei o email de login desse colaborador." }), { status: 404, headers: corsHeaders });
    }

    const senhaTemp = gerarSenhaTemporaria();
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: senhaTemp });
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: corsHeaders });
    }

    let warning: string | undefined;
    try {
      await enviarSenhaPorEmail(authUser.user.email, targetProfile.nome, senhaTemp, targetProfile.organizations?.nome ?? "seu escritório");
    } catch (emailErr) {
      warning = `Senha redefinida, mas ${(emailErr as Error).message}. Nova senha temporária: ${senhaTemp}`;
    }

    return new Response(JSON.stringify({ ok: true, warning }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
