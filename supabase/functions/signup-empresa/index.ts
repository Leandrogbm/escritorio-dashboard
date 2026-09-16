// Cadastro self-service de uma nova empresa (organization): cria a organization, o Auth
// user (com a senha que a pessoa escolheu) e o profile como admin dessa org — tudo numa
// tacada, com service_role, porque um visitante sem org ainda não passa em auth_org_id()
// pra se auto-inserir em nada (ver comentário da policy de organizations no schema.sql).
// Diferente de admin-create-user: aqui NÃO tem checagem de "quem chama" — é o próprio
// cadastro público, é o único ponto de entrada de uma empresa nova no sistema.
//
// Trial por uso, não por tempo: NÃO cobra nada nem cria checkout — toda org nova entra no
// plano 'gratis' (2 clientes/2 processos/2 usuários, limite de verdade via plan_limits,
// mesmo mecanismo de RLS que os planos pagos já usam) com status_pagamento='pago' (nada
// devendo, não "pagou de verdade"). Assinar um plano pago depois é outra Edge Function
// (mercado-pago-criar-assinatura, Payment Brick embutido em MinhaEmpresaTab).
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

// Verifica o token do Cloudflare Turnstile direto com a Cloudflare — nunca confia no token
// vindo do client sozinho. Evita criação de conta em massa/automatizada (achado real do
// qa-guardian: combinado com a trava de pagamento, sem isso um atacante contornava o limite
// de tentativas por org só criando conta nova a cada 5 tentativas de cartão).
async function captchaValido(token: string, ip: string | null) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return true; // Turnstile ainda não configurado — não bloqueia cadastro por isso.
  if (!token) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    return !!data?.success;
  } catch {
    return false; // Cloudflare fora do ar/timeout — mais seguro recusar que deixar passar.
  } finally {
    clearTimeout(timeout);
  }
}

// Rollback do Auth user quando um passo seguinte do cadastro falha. Achado real: se esse
// delete falhar também (raro, mas já aconteceu — deixou "teste@teste.com.br" travado por
// dias, sem profile nenhum, bloqueando qualquer novo cadastro com esse email), a falha
// desaparecia em silêncio. Agora fica nos logs da function, com o id pra alguém limpar.
async function desfazerUsuario(admin: ReturnType<typeof createClient>, userId: string, motivo: string) {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error(`Rollback de auth user falhou (${motivo}). userId=${userId} — limpar manualmente.`, error.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { nomeEmpresa, cnpj, nomeResponsavel, email, password, termosAceitos, captchaToken } = await req.json();
    const cnpjDigits = limparCnpj(cnpj);

    if (!(await captchaValido(captchaToken, req.headers.get("x-forwarded-for")))) {
      return new Response(JSON.stringify({ error: "Confirma que você não é um robô pra continuar." }), { status: 400, headers: corsHeaders });
    }

    if (cnpjDigits && ![11, 14].includes(cnpjDigits.length)) {
      return new Response(JSON.stringify({ error: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido." }), { status: 400, headers: corsHeaders });
    }
    if (!nomeEmpresa || !nomeResponsavel || !email || !password || ![11, 14].includes(cnpjDigits.length)) {
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
      .insert({
        nome: nomeEmpresa, slug: cnpjDigits, cnpj: cnpjDigits, termos_aceite: true, termos_aceite_em: new Date().toISOString(),
        // Todo cadastro novo começa no trial (plano='gratis'): sem checkout, sem cobrança —
        // status_pagamento='pago' aqui significa "nada devendo", não que pagou de verdade.
        plano: "gratis", valor_mensal: 0, status_pagamento: "pago",
      })
      .select("id")
      .single();
    if (orgErr) {
      await desfazerUsuario(admin, created.user.id, "orgErr");
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
      await desfazerUsuario(admin, created.user.id, "profileErr");
      await admin.from("organizations").delete().eq("id", org.id);
      return new Response(JSON.stringify({ error: profileErr.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
