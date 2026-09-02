// Cadastro self-service de uma nova empresa (organization): cria a organization, o Auth
// user (com a senha que a pessoa escolheu) e o profile como admin dessa org — tudo numa
// tacada, com service_role, porque um visitante sem org ainda não passa em auth_org_id()
// pra se auto-inserir em nada (ver comentário da policy de organizations no schema.sql).
// Diferente de admin-create-user: aqui NÃO tem checagem de "quem chama" — é o próprio
// cadastro público, é o único ponto de entrada de uma empresa nova no sistema.
//
// Deploy: supabase functions deploy signup-empresa --no-verify-jwt
// (--no-verify-jwt porque não existe usuário logado ainda nesse momento)

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function limparCnpj(cnpj: string) {
  return (cnpj || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { nomeEmpresa, cnpj, nomeResponsavel, email, password, termosAceitos } = await req.json();
    const cnpjDigits = limparCnpj(cnpj);

    if (!nomeEmpresa || !nomeResponsavel || !email || !password || cnpjDigits.length !== 14) {
      return new Response(
        JSON.stringify({ error: "Preencha nome da empresa, CNPJ válido (14 dígitos), responsável, email e senha." }),
        { status: 400, headers: corsHeaders }
      );
    }
    // Aceite dos Termos de Uso/Política de Privacidade do Actum é do ESCRITÓRIO que está se
    // cadastrando (cliente do Actum), não dos clientes que ele atende — ver comentário no
    // schema.sql. Obrigatório pra criar a organização.
    if (!termosAceitos) {
      return new Response(JSON.stringify({ error: "É preciso aceitar os Termos de Uso e a Política de Privacidade." }), { status: 400, headers: corsHeaders });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "A senha precisa ter pelo menos 6 caracteres." }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) {
      // mensagem genérica de propósito: devolver "esse e-mail já existe" deixa qualquer
      // visitante sem login descobrir se um e-mail específico já tem conta no Actum, em
      // qualquer empresa da plataforma (achado do qa-guardian numa auditoria de acesso
      // não-autenticado) — mesmo tratamento que "esqueci minha senha" já dá em Login.jsx.
      return new Response(JSON.stringify({ error: "Não foi possível concluir o cadastro. Verifique os dados ou fale com o suporte." }), { status: 400, headers: corsHeaders });
    }

    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({ nome: nomeEmpresa, slug: cnpjDigits, cnpj: cnpjDigits, termos_aceite: true, termos_aceite_em: new Date().toISOString() })
      .select("id")
      .single();
    if (orgErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      // mesmo motivo do bloco acima: não confirmar pra um visitante sem login se um CNPJ
      // específico já é cliente do Actum.
      return new Response(JSON.stringify({ error: "Não foi possível concluir o cadastro. Verifique os dados ou fale com o suporte." }), { status: 400, headers: corsHeaders });
    }

    const { error: profileErr } = await admin.from("profiles").insert({
      id: created.user.id,
      org_id: org.id,
      nome: nomeResponsavel,
      role: "admin",
    });
    if (profileErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      await admin.from("organizations").delete().eq("id", org.id);
      return new Response(JSON.stringify({ error: profileErr.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
