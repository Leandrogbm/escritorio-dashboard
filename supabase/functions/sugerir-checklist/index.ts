// Sugere um checklist inicial de tarefas pra um processo, a partir da área do direito, usando
// a API da Anthropic (Claude). Não salva nada sozinha — devolve a lista, quem chama decide
// quais tarefas realmente criar (revisão do advogado antes de virar tarefa de verdade).
//
// Deploy: supabase functions deploy sugerir-checklist
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
      return new Response(JSON.stringify({ error: "Sugestão por IA ainda não foi configurada (falta a chave da Anthropic)." }), { status: 400, headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });
    }

    const { area, numero } = await req.json();
    if (!area) {
      return new Response(JSON.stringify({ error: "area é obrigatória." }), { status: 400, headers: corsHeaders });
    }

    const prompt = `Você é assistente de um escritório de advocacia brasileiro. Pra um processo novo cadastrado na área "${area}"${numero ? ` (número ${numero})` : ""}, sugira um checklist inicial de 4 a 7 tarefas típicas desse tipo de caso, do tipo "coisas que normalmente precisam ser feitas no início/andamento desse processo" (ex.: reunir documentação, protocolar petição inicial, acompanhar prazo de contestação, etc. — adaptado à área). Responda SOMENTE um array JSON de strings curtas (cada uma até ~8 palavras), sem texto antes ou depois. Ex.: ["Reunir documentos do cliente","Protocolar petição inicial"]`;

    // Timeout explícito — sem isso, se a Anthropic travar/demorar, a function fica pendurada
    // pra sempre e o botão no front vira "Gerando..." eterno (bug real já visto em produção).
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let claudeRes: Response;
    try {
      claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
        signal: controller.signal,
      });
    } catch (err) {
      const timedOut = (err as Error).name === "AbortError";
      return new Response(JSON.stringify({ error: timedOut ? "A IA demorou demais pra responder. Tenta de novo." : `Falha ao chamar a IA: ${(err as Error).message}` }), { status: 504, headers: corsHeaders });
    } finally {
      clearTimeout(timeout);
    }
    if (!claudeRes.ok) {
      const erro = await claudeRes.text();
      return new Response(JSON.stringify({ error: `Falha ao gerar sugestão: ${erro}` }), { status: 502, headers: corsHeaders });
    }

    const claudeBody = await claudeRes.json();
    const texto = (claudeBody.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");
    const match = texto.match(/\[[\s\S]*\]/);
    if (!match) {
      return new Response(JSON.stringify({ error: "A IA não devolveu uma lista válida." }), { status: 502, headers: corsHeaders });
    }
    let itens: unknown;
    try {
      itens = JSON.parse(match[0]);
    } catch {
      return new Response(JSON.stringify({ error: "A IA não devolveu uma lista válida." }), { status: 502, headers: corsHeaders });
    }
    if (!Array.isArray(itens)) {
      return new Response(JSON.stringify({ error: "A IA não devolveu uma lista válida." }), { status: 502, headers: corsHeaders });
    }
    const checklist = itens.filter((i) => typeof i === "string" && i.trim()).map((i) => (i as string).trim());

    return new Response(JSON.stringify({ ok: true, checklist }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
