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
    const { nomeEmpresa, cnpj, nomeResponsavel, email, password, termosAceitos, plano } = await req.json();
    const cnpjDigits = limparCnpj(cnpj);

    if (cnpjDigits && ![11, 14].includes(cnpjDigits.length)) {
      return new Response(JSON.stringify({ error: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido." }), { status: 400, headers: corsHeaders });
    }
    if (!nomeEmpresa || !nomeResponsavel || !email || !password || ![11, 14].includes(cnpjDigits.length)) {
      return new Response(
        JSON.stringify({ error: "Preencha nome da empresa, CNPJ válido (14 dígitos), responsável, email e senha." }),
        { status: 400, headers: corsHeaders }
      );
    }
    if (!plano) {
      return new Response(JSON.stringify({ error: "Escolha um plano para concluir o cadastro." }), { status: 400, headers: corsHeaders });
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
    const mercadoPagoToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mercadoPagoToken) {
      return new Response(JSON.stringify({ error: "O checkout de pagamento ainda não foi configurado. Fale com o suporte." }), { status: 503, headers: corsHeaders });
    }

    // Preço vem do banco (plan_limits), nunca do que o client mandou.
    let planoValidado: { plano: string; valor_mensal: number } | null = null;
    if (plano) {
      const { data: limite } = await admin.from("plan_limits").select("plano, valor_mensal").eq("plano", plano).maybeSingle();
      if (!limite) {
        return new Response(JSON.stringify({ error: "Plano inválido." }), { status: 400, headers: corsHeaders });
      }
      planoValidado = limite;
    }

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
        // plano/valor_mensal só dá pra setar aqui, no INSERT — um UPDATE depois seria
        // zerado pelo trigger trg_guard_organizations_protected_cols (só deixa platform
        // admin mexer nisso, e a Edge Function roda como service role, sem auth.uid()).
        ...(planoValidado ? { plano: planoValidado.plano, valor_mensal: planoValidado.valor_mensal, status_pagamento: "pendente" } : {}),
      })
      .select("id")
      .single();
    if (orgErr) {
      await desfazerUsuario(admin, created.user.id, "orgErr");
      // mesmo motivo do bloco acima: não confirmar pra um visitante sem login se um CNPJ
      // específico já é cliente do Actum.
      return new Response(JSON.stringify({ error: "Não foi possível concluir o cadastro. Verifique os dados ou fale com o suporte." }), { status: 400, headers: corsHeaders });
    }

    // Cria o histórico antes de publicar o checkout: assim, se o pagamento for aprovado
    // muito rápido, o webhook já encontra a cobrança inicial para marcar como paga.
    const primeiroDia = new Date();
    primeiroDia.setDate(1);
    const cobrancas = Array.from({ length: 6 }, (_, n) => {
      const mes = new Date(primeiroDia);
      mes.setMonth(mes.getMonth() + n);
      return { org_id: org.id, mes_referencia: mes.toISOString().slice(0, 10), valor: planoValidado!.valor_mensal, status: "pendente" };
    });
    const { error: cobrancasError } = await admin.from("platform_cobrancas").insert(cobrancas);
    if (cobrancasError) {
      await admin.from("organizations").delete().eq("id", org.id);
      await desfazerUsuario(admin, created.user.id, "cobrancasError");
      throw cobrancasError;
    }

    // Cada cadastro recebe um checkout próprio, com a organização como referência. Isso
    // permite que o webhook libere somente quem tiver o pagamento aprovado.
    const preferenceRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${mercadoPagoToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{
          title: `Actum — Plano ${planoValidado!.plano}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(planoValidado!.valor_mensal),
        }],
        payer: { email },
        external_reference: org.id,
        metadata: { tipo: "actum_assinatura", org_id: org.id },
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercado-pago-webhook`,
      }),
    });
    const preference = await preferenceRes.json().catch(() => null);
    const checkoutUrl = preference?.init_point;
    if (!preferenceRes.ok || !checkoutUrl) {
      await admin.from("organizations").delete().eq("id", org.id);
      await desfazerUsuario(admin, created.user.id, "checkout mercado pago");
      return new Response(JSON.stringify({ error: "Não foi possível gerar o checkout de pagamento. Tente novamente mais tarde." }), { status: 502, headers: corsHeaders });
    }
    const { error: checkoutError } = await admin.from("organizations").update({ mercado_pago_checkout_url: checkoutUrl }).eq("id", org.id);
    if (checkoutError) {
      await admin.from("organizations").delete().eq("id", org.id);
      await desfazerUsuario(admin, created.user.id, "checkoutError");
      return new Response(JSON.stringify({ error: "Não foi possível preparar o pagamento. Tente novamente mais tarde." }), { status: 500, headers: corsHeaders });
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

    return new Response(JSON.stringify({ ok: true, checkoutUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
