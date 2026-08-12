// Cria um novo colaborador: gera uma senha temporária, cria o Auth user já com ela,
// manda por email via Resend, e insere a linha correspondente em profiles. Roda com a
// service_role key — por isso é Edge Function e não código do client (a service_role
// nunca pode ir pro browser).
//
// Deploy: supabase functions deploy admin-create-user
// Secrets SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem por padrão em toda function.
// Secret extra necessário: supabase secrets set RESEND_API_KEY=<chave de resend.com/api-keys>

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function gerarSenhaTemporaria() {
  // 12 chars alfanuméricos — passa nas regras padrão de senha do Supabase Auth (mín. 6).
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

async function enviarSenhaPorEmail(email: string, nome: string, senha: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Gimenes & Pires <nao-responda@mysaldo.com.br>",
      to: email,
      subject: "Acesso ao Dashboard — Gimenes & Pires",
      text: `Olá, ${nome}!\n\nSua conta foi criada. Login: ${email}\nSenha temporária: ${senha}\n\nTroque a senha no primeiro acesso.`,
    }),
  });
  if (!res.ok) throw new Error(`Falha ao enviar email: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Identifica quem chamou a partir do JWT (anon key só decodifica, service role ignora RLS)
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
    if (!callerProfile || callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Só admin pode criar colaborador." }), { status: 403, headers: corsHeaders });
    }

    const { nome, email, role } = await req.json();
    const ALLOWED_ROLES = ["socio", "advogado", "financeiro", "recepcao", "admin"]; // espelha o check constraint de profiles.role
    if (!nome || !email || !ALLOWED_ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: "Nome, email e cargo válido são obrigatórios." }), { status: 400, headers: corsHeaders });
    }

    const senhaTemp = gerarSenhaTemporaria();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: senhaTemp,
      email_confirm: true, // já entra confirmado — a senha temp já é a prova de posse do email
    });
    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: corsHeaders });
    }

    const { error: insertErr } = await admin.from("profiles").insert({
      id: created.user.id,
      org_id: callerProfile.org_id,
      nome,
      role,
    });
    if (insertErr) {
      // profile falhou — desfaz o Auth user pra não deixar conta órfã sem perfil.
      await admin.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 400, headers: corsHeaders });
    }

    let warning: string | undefined;
    try {
      await enviarSenhaPorEmail(email, nome, senhaTemp);
    } catch (emailErr) {
      // usuário e profile já existem — não desfaz por causa do email, só avisa o admin
      // pra passar a senha manualmente.
      warning = `Colaborador criado, mas ${(emailErr as Error).message}. Senha temporária: ${senhaTemp}`;
    }

    return new Response(JSON.stringify({ ok: true, warning }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
