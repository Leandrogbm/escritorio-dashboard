// Resume as movimentações de um processo em linguagem simples, usando a API da Anthropic
// (Claude). Cacheado em processos.resumo_ia — só reprocessa quando o usuário pede de novo
// (botão "Atualizar resumo"), pra não gastar chamada de API sozinho a cada sync do DataJud.
//
// Deploy: supabase functions deploy resumir-andamentos
// Secret necessário: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Resumo por IA ainda não foi configurado (falta a chave da Anthropic)." }), { status: 400, headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });
    }
    const { data: callerProfile } = await admin.from("profiles").select("org_id").eq("id", caller.id).single();
    const { data: platformAdminRow } = await admin.from("platform_admins").select("user_id").eq("user_id", caller.id).maybeSingle();
    const ehPlatformAdmin = !!platformAdminRow;
    if (!ehPlatformAdmin && !callerProfile) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });
    }

    const { processoId } = await req.json();
    if (!processoId) {
      return new Response(JSON.stringify({ error: "processoId é obrigatório." }), { status: 400, headers: corsHeaders });
    }

    const { data: processo } = await admin.from("processos").select("id, numero, org_id").eq("id", processoId).single();
    if (!processo) {
      return new Response(JSON.stringify({ error: "Processo não encontrado." }), { status: 404, headers: corsHeaders });
    }
    if (!ehPlatformAdmin && processo.org_id !== callerProfile.org_id) {
      return new Response(JSON.stringify({ error: "Processo não encontrado." }), { status: 404, headers: corsHeaders });
    }

    const { data: movimentacoes } = await admin
      .from("movimentacoes_processo")
      .select("nome, data_hora, requer_atencao")
      .eq("processo_id", processoId)
      .order("data_hora", { ascending: true });

    if (!movimentacoes || movimentacoes.length === 0) {
      return new Response(JSON.stringify({ error: "Esse processo ainda não tem andamento sincronizado pra resumir." }), { status: 400, headers: corsHeaders });
    }

    const listaMovimentacoes = movimentacoes
      .map((m) => `- ${new Date(m.data_hora).toLocaleDateString("pt-BR")}: ${m.nome}${m.requer_atencao ? " (requer atenção)" : ""}`)
      .join("\n");

    const prompt = `Você é assistente de um escritório de advocacia brasileiro. Resuma o andamento processual abaixo (processo ${processo.numero}) em linguagem simples e direta, em português, pra um advogado ler em segundos e entender rápido o que aconteceu e o que está pendente. No máximo 4-5 frases. Não invente informação que não está na lista.\n\nMovimentações:\n${listaMovimentacoes}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const erro = await claudeRes.text();
      return new Response(JSON.stringify({ error: `Falha ao gerar resumo: ${erro}` }), { status: 502, headers: corsHeaders });
    }

    const claudeBody = await claudeRes.json();
    const resumo = claudeBody.content?.[0]?.text?.trim();
    if (!resumo) {
      return new Response(JSON.stringify({ error: "A IA não devolveu nenhum texto." }), { status: 502, headers: corsHeaders });
    }

    await admin.from("processos").update({ resumo_ia: resumo, resumo_ia_gerado_em: new Date().toISOString() }).eq("id", processoId);

    return new Response(JSON.stringify({ ok: true, resumo }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
