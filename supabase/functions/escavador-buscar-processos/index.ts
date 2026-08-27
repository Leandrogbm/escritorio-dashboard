// Busca processos de um cliente (CPF/CNPJ) na API paga do Escavador — só devolve a lista
// pra revisão humana, igual foi desenhado pra DataJud: resultado pode vir errado (nome
// parecido, processo antigo), quem decide o que vira registro em Processos é o usuário
// (ver botão "Buscar processos" em ClientesTab.jsx).
//
// Token é DA CONTA PAGA do escritório (integracoes.escavador_token, colado em
// Configurações → Integrações → Escavador) — fica só aqui no servidor, nunca no bundle do
// browser, porque cada busca é cobrada na conta do cliente.
//
// Endpoint conforme documentação pública da API v2 do Escavador — sem teste contra conta
// real (não temos credencial de teste); se o formato mudou, o erro da própria Escavador
// aparece pro usuário em vez de falhar silencioso.
//
// Deploy: supabase functions deploy escavador-buscar-processos

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEOUT_MS = 20000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });
    }
    const { data: callerProfile } = await admin.from("profiles").select("org_id, role").eq("id", caller.id).single();
    if (!callerProfile || !["admin", "socio"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Só admin ou sócio podem buscar." }), { status: 403, headers: corsHeaders });
    }

    const { data: integ } = await admin.from("integracoes").select("escavador_token").eq("org_id", callerProfile.org_id).single();
    if (!integ?.escavador_token) {
      return new Response(JSON.stringify({ error: "Conecte a conta Escavador em Configurações → Integrações antes de buscar." }), { status: 400, headers: corsHeaders });
    }

    const { clienteId } = await req.json();
    const { data: cliente } = await admin.from("clientes").select("id, documento").eq("id", clienteId).eq("org_id", callerProfile.org_id).single();
    if (!cliente) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado." }), { status: 404, headers: corsHeaders });
    }
    const documento = (cliente.documento || "").replace(/\D/g, "");
    if (documento.length !== 11 && documento.length !== 14) {
      return new Response(JSON.stringify({ error: "Cliente sem CPF/CNPJ cadastrado — preencha antes de buscar." }), { status: 400, headers: corsHeaders });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`https://api.escavador.com/api/v2/envolvido/processos?cpf_cnpj=${documento}&limit=50`, {
        headers: { Authorization: `Bearer ${integ.escavador_token}` },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      return new Response(JSON.stringify({ error: `Escavador retornou ${res.status}: ${corpo.slice(0, 300)}` }), { status: 502, headers: corsHeaders });
    }

    const body = await res.json();
    const itens = body?.items ?? body?.data ?? [];
    const resultados = itens.map((p: any) => ({
      numeroProcesso: p.numero_cnj ?? p.numero ?? null,
      tribunal: p.unidade_origem?.tribunal_sigla ?? p.tribunal ?? null,
      classe: p.classe ?? p.fontes?.[0]?.classe ?? null,
      assunto: p.assunto ?? null,
      dataInicio: p.data_inicio ?? null,
      ultimaMovimentacao: p.data_ultima_movimentacao ?? null,
    }));

    return new Response(JSON.stringify({ ok: true, resultados }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
