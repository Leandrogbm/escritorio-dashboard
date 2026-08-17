// Sincroniza andamentos processuais via API pública do DataJud (CNJ) pros processos
// cadastrados, e gera notificação pra cada andamento novo (marcando "requer atenção"
// quando bate em algum termo de termos_atencao — intimação, prazo, sentença, etc.).
//
// Dois jeitos de chamar:
//  1. Cron (pg_cron, via header x-cron-secret === DATAJUD_CRON_SECRET) — sincroniza TODOS
//     os processos ativos de TODAS as empresas, 1x/dia.
//  2. Usuário autenticado (admin/sócio) — botão "Sincronizar agora", só a própria empresa.
//
// O DataJud só traz "o processo teve movimentação", não o teor da intimação nem o prazo
// pronto — por isso a Edge Function separada de alerta de prazo (gerar_alertas_prazos, é
// função SQL agendada direto, não precisa de Edge Function) e o cadastro manual de prazo
// a partir de uma movimentação (ver PrazosTab.jsx).
//
// Deploy: supabase functions deploy datajud-sync --no-verify-jwt
// (--no-verify-jwt porque o cron chama sem JWT de usuário — a checagem de quem pode chamar
// é feita na mão dentro da function, via x-cron-secret OU um JWT de usuário válido)
// Secrets: DATAJUD_API_KEY (chave pública do CNJ), DATAJUD_CRON_SECRET (string aleatória sua)

import { createClient } from "npm:@supabase/supabase-js@2";
import { extrairTribunalAlias, numeroCnjValido } from "./tribunais.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const DATAJUD_TIMEOUT_MS = 15000;

function limparNumero(numero: string) {
  return (numero || "").replace(/\D/g, "");
}

function dedupKey(nome: string, dataHora: string) {
  // hash simples e determinístico — não precisa ser criptográfico, só evitar duplicata
  const s = `${nome}|${dataHora}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

async function consultaDataJud(alias: string, numero: string, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DATAJUD_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`, {
      method: "POST",
      headers: { Authorization: `APIKey ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: { match: { numeroProcesso: numero } } }),
      signal: controller.signal,
    });
    if (res.status === 404) throw new Error(`Índice do tribunal '${alias}' não encontrado`);
    if (res.status === 429) throw new Error("Rate limit do DataJud atingido, tenta de novo mais tarde");
    if (!res.ok) throw new Error(`DataJud retornou ${res.status}: ${await res.text()}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function sincronizarProcesso(admin: ReturnType<typeof createClient>, processo: any, apiKey: string, termos: string[]) {
  const numeroLimpo = limparNumero(processo.numero);

  if (!numeroCnjValido(processo.numero)) {
    await admin.from("processos").update({
      datajud_status: "nao_suportado",
      datajud_erro: "Número não está no formato CNJ de 20 dígitos válido",
      ultima_verificacao_datajud: new Date().toISOString(),
    }).eq("id", processo.id);
    return { id: processo.id, status: "nao_suportado" as const };
  }

  const alias = extrairTribunalAlias(processo.numero);
  if (!alias) {
    await admin.from("processos").update({
      datajud_status: "nao_suportado",
      datajud_erro: "Não foi possível identificar o tribunal a partir do número",
      ultima_verificacao_datajud: new Date().toISOString(),
    }).eq("id", processo.id);
    return { id: processo.id, status: "nao_suportado" as const };
  }

  try {
    const resultado = await consultaDataJud(alias, numeroLimpo, apiKey);
    const hit = resultado?.hits?.hits?.[0]?._source;
    const movimentos: any[] = hit?.movimentos ?? [];

    const { data: existentes } = await admin
      .from("movimentacoes_processo")
      .select("dedup_key")
      .eq("processo_id", processo.id);
    const jaConhecidos = new Set((existentes ?? []).map((m) => m.dedup_key));

    const novos = movimentos
      .map((m) => ({ ...m, _key: dedupKey(m.nome ?? "", m.dataHora ?? "") }))
      .filter((m) => !jaConhecidos.has(m._key));

    let novosMovimentos = 0;
    for (const m of novos) {
      const nome: string = m.nome ?? "Movimentação sem nome";
      const requerAtencao = termos.some((t) => nome.toLowerCase().includes(t.toLowerCase()));

      const { data: inserted, error: insErr } = await admin.from("movimentacoes_processo").insert({
        org_id: processo.org_id,
        processo_id: processo.id,
        nome,
        data_hora: m.dataHora,
        complemento: m.complementosTabelados ?? null,
        requer_atencao: requerAtencao,
        dedup_key: m._key,
      }).select("id").single();
      if (insErr) continue; // conflito de dedup_key concorrente, ou outro erro pontual — segue o baile
      novosMovimentos++;

      await admin.from("notificacoes").insert({
        org_id: processo.org_id,
        processo_id: processo.id,
        movimentacao_id: inserted.id,
        tipo: "movimentacao",
        titulo: `Nova movimentação — processo ${processo.numero}`,
        texto: nome,
        requer_atencao: requerAtencao,
      });
    }

    await admin.from("processos").update({
      tribunal_alias: alias,
      datajud_status: "ok",
      datajud_erro: null,
      ultima_verificacao_datajud: new Date().toISOString(),
    }).eq("id", processo.id);

    return { id: processo.id, status: "ok" as const, novosMovimentos };
  } catch (err) {
    await admin.from("processos").update({
      tribunal_alias: alias,
      datajud_status: "erro",
      datajud_erro: (err as Error).message,
      ultima_verificacao_datajud: new Date().toISOString(),
    }).eq("id", processo.id);
    return { id: processo.id, status: "erro" as const, erro: (err as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const apiKey = Deno.env.get("DATAJUD_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "DATAJUD_API_KEY não configurada." }), { status: 500, headers: corsHeaders });
    }

    const cronSecret = req.headers.get("x-cron-secret");
    const chamadaPorCron = cronSecret && cronSecret === Deno.env.get("DATAJUD_CRON_SECRET");

    let orgIdFiltro: string | null = null;
    if (!chamadaPorCron) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const { data: { user: caller }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
      if (authErr || !caller) {
        return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });
      }
      const { data: callerProfile } = await admin.from("profiles").select("org_id, role").eq("id", caller.id).single();
      if (!callerProfile || !["admin", "socio"].includes(callerProfile.role)) {
        return new Response(JSON.stringify({ error: "Só admin ou sócio podem sincronizar." }), { status: 403, headers: corsHeaders });
      }
      orgIdFiltro = callerProfile.org_id;
    }

    const { data: termosRows } = await admin.from("termos_atencao").select("termo");
    const termos = (termosRows ?? []).map((t) => t.termo);

    let query = admin.from("processos").select("id, org_id, numero").neq("status", "Encerrado");
    if (orgIdFiltro) query = query.eq("org_id", orgIdFiltro);
    const { data: processos, error: procErr } = await query;
    if (procErr) throw procErr;

    const resultados = [];
    for (const p of processos ?? []) {
      resultados.push(await sincronizarProcesso(admin, p, apiKey, termos));
    }

    const resumo = {
      processados: resultados.length,
      ok: resultados.filter((r) => r.status === "ok").length,
      erros: resultados.filter((r) => r.status === "erro").length,
      nao_suportados: resultados.filter((r) => r.status === "nao_suportado").length,
      novos_movimentos: resultados.reduce((s, r: any) => s + (r.novosMovimentos ?? 0), 0),
    };
    return new Response(JSON.stringify({ ok: true, ...resumo, detalhes: resultados }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
