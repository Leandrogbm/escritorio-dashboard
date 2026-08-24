// Cria acesso ao Portal do Cliente pra um cliente já cadastrado: gera senha temporária,
// cria o Auth user, insere em cliente_logins e manda credenciais por email (mesmo padrão de
// admin-create-user/admin-reset-password). Só admin/sócio da própria empresa (ou platform
// admin) podem chamar.
//
// Deploy: supabase functions deploy cliente-create-login

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
      subject: `Acompanhe seu processo — ${orgNome}`,
      text: `Olá, ${nome}!\n\n${orgNome} liberou seu acesso ao portal pra você acompanhar seu processo.\nLogin: ${email}\nSenha temporária: ${senha}\n\nTroque a senha no primeiro acesso.`,
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
      return new Response(JSON.stringify({ error: "Só admin, sócio ou o admin da plataforma podem liberar acesso ao portal." }), { status: 403, headers: corsHeaders });
    }

    const { clienteId, email } = await req.json();
    if (!clienteId || !email) {
      return new Response(JSON.stringify({ error: "clienteId e email são obrigatórios." }), { status: 400, headers: corsHeaders });
    }

    const { data: cliente } = await admin.from("clientes").select("id, nome, org_id, organizations(nome)").eq("id", clienteId).single();
    if (!cliente) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado." }), { status: 404, headers: corsHeaders });
    }
    if (!ehPlatformAdmin && cliente.org_id !== callerProfile.org_id) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado." }), { status: 404, headers: corsHeaders });
    }

    const { data: jaTemAcesso } = await admin.from("cliente_logins").select("user_id").eq("cliente_id", clienteId).maybeSingle();
    if (jaTemAcesso) {
      return new Response(JSON.stringify({ error: "Esse cliente já tem acesso ao portal." }), { status: 400, headers: corsHeaders });
    }

    const senhaTemp = gerarSenhaTemporaria();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: senhaTemp,
      email_confirm: true,
    });
    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: corsHeaders });
    }

    const { error: insertErr } = await admin.from("cliente_logins").insert({
      user_id: created.user.id,
      org_id: cliente.org_id,
      cliente_id: clienteId,
    });
    if (insertErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      const msg = insertErr.code === "23505" ? "Esse cliente já tem acesso ao portal." : insertErr.message;
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers: corsHeaders });
    }

    const orgNome = cliente.organizations?.nome ?? "seu escritório";
    let warning: string | undefined;
    try {
      await enviarSenhaPorEmail(email, cliente.nome, senhaTemp, orgNome);
    } catch (emailErr) {
      warning = `Acesso criado, mas ${(emailErr as Error).message}. Senha temporária: ${senhaTemp}`;
    }

    return new Response(JSON.stringify({ ok: true, warning }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
