// Sincroniza andamentos processuais via API pública do DataJud (CNJ) pros processos
// cadastrados, e gera notificação pra cada andamento novo. "requer atenção" é decidido por
// DUAS camadas, que se somam (uma marca true, já é true — prefere alarme falso a perder
// prazo): (1) lista de palavras de termos_atencao (sempre roda); (2) se ANTHROPIC_API_KEY
// tiver configurada, a IA lê o TEOR de cada movimentação nova e decide se exige ação —
// pega caso que a lista de palavras não cobre (ex.: nome de movimentação incomum que não
// bate nenhum termo, mas o conteúdo deixa claro que é urgente). Se a IA falhar/não estiver
// configurada, cai só na camada 1 (comportamento de sempre, nunca quebra o sync por isso).
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
// DataJud é a ÚNICA fonte pública gratuita pra isso no Brasil — mas o índice nacional do CNJ
// não tem todo processo (vara/comarca menor, processo recém-distribuído, atraso de
// alimentação do próprio tribunal). Quando ele vem vazio, tenta a Escavador como 2ª fonte
// (consultaEscavador) — paga, mas já contratada pelo escritório (mesmo token usado em
// "Buscar processos"/ClientesTab), então não é custo novo, só reaproveita o que já existe.
//
// Deploy: supabase functions deploy datajud-sync --no-verify-jwt
// (--no-verify-jwt porque o cron chama sem JWT de usuário — a checagem de quem pode chamar
// é feita na mão dentro da function, via x-cron-secret OU um JWT de usuário válido)
// Secrets: DATAJUD_API_KEY (chave pública do CNJ), DATAJUD_CRON_SECRET (string aleatória sua),
// ANTHROPIC_API_KEY (opcional — sem ela, só a camada de palavra-chave roda)

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

// Só notifica se a movimentação é recente (semana ou mês corrente no momento do sync) — o
// DataJud/Escavador devolve o HISTÓRICO inteiro do processo, então a primeira sincronização
// (ou a 1ª vez que a Escavador acha um processo que o DataJud nunca indexou) tratava cada
// andamento antigo, de anos atrás, como "novo" só por nunca ter sido visto antes, enchendo o
// painel Hoje de notificação sem sentido (feedback real do usuário vendo isso em produção). A
// movimentação em si continua indo pra movimentacoes_processo (histórico do processo) sempre
// — só a notificação (o que aparece pro usuário como "aconteceu agora") fica de fora.
function movimentacaoRecente(dataHoraISO: string | null): boolean {
  if (!dataHoraISO) return false;
  const dt = new Date(dataHoraISO);
  if (isNaN(dt.getTime())) return false;
  const agora = new Date();
  const mesmoMes = dt.getFullYear() === agora.getFullYear() && dt.getMonth() === agora.getMonth();
  if (mesmoMes) return true;
  // mesma semana (segunda a domingo) cobre o caso de a semana atravessar a virada do mês
  const diasDesdeSegunda = (agora.getDay() + 6) % 7;
  const inicioSemana = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - diasDesdeSegunda);
  return dt >= inicioSemana;
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

const ESCAVADOR_TIMEOUT_MS = 20000;

// Plano B quando o DataJud não tem o processo indexado (comum pra vara/comarca menor, ou
// processo recém-distribuído — limitação real da base pública do CNJ, não bug daqui, ver
// CLAUDE.md). A Escavador busca direto nos sistemas de cada tribunal (e-SAJ/PJe), cobertura
// maior — só dispara quando o DataJud já voltou vazio, então não dobra o custo por processo
// à toa. Token é o mesmo já usado em "Buscar processos" (ClientesTab), org precisa ter
// conectado em Configurações → Integrações.
//
// Formato de resposta conforme documentação pública da API v2 — sem teste contra uma conta
// paga real ainda (mesma ressalva já feita em escavador-buscar-processos/index.ts); se o
// formato mudou, cai no catch e o processo só fica sem essa 2ª tentativa, não quebra o sync.
async function consultaEscavador(numeroCnj: string, token: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ESCAVADOR_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.escavador.com/api/v2/processos/numero_cnj/${numeroCnj}?com_movimentacoes=1`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = await res.json();
    const andamentos = body?.fontes?.flatMap((f: any) => f.andamentos ?? []) ?? body?.movimentacoes ?? [];
    return andamentos.map((a: any) => ({
      nome: a.conteudo ?? a.texto_categoria ?? a.tipo ?? a.nome ?? "Movimentação",
      dataHora: a.data_hora ?? a.data ?? a.dataHora ?? null,
      complementosTabelados: null,
    })).filter((m: any) => m.dataHora);
  } catch {
    return null; // rede/timeout/formato inesperado — segue sem essa 2ª fonte, não derruba o sync
  } finally {
    clearTimeout(timeout);
  }
}

type ClassificacaoIA = { requerAtencao: boolean; prazoTipo: string | null; prazoDias: number | null; prazoDiasUteis: boolean | null };

// Pede pra IA classificar, de uma vez, TODAS as movimentações novas de um processo — 1
// chamada por processo (não 1 por movimentação), pra não multiplicar custo/latência. Além de
// "exige atenção", pede pra sugerir TIPO e QUANTIDADE DE DIAS do prazo quando a movimentação
// for do tipo "intimação para X" — mesma função, prompt mais rico, sem chamada extra (feature
// "sugestão de prazo por IA", comparada com o Legal One no ROADMAP-comparativo.md).
// Retorna null em qualquer falha (JSON inválido, API fora, timeout) — quem chama já sabe
// cair pra camada de palavra-chave nesse caso (sem prazo sugerido), nunca deixa o sync
// quebrar por isso.
async function classificarComIA(nomes: string[], anthropicKey: string): Promise<ClassificacaoIA[] | null> {
  try {
    const lista = nomes.map((n, i) => `${i}: ${n}`).join("\n");
    const prompt = `Você é assistente jurídico brasileiro. Pra cada movimentação processual abaixo, analise e responda:
1. "requerAtencao": exige ação/atenção do advogado em breve (ex.: intimação, prazo, decisão, sentença, despacho que pede manifestação)? Ou é só trâmite burocrático de rotina (ex.: juntada de documento, conclusão, distribuição, remessa)?
2. Se a movimentação for uma intimação/prazo processual identificável (ex.: "intimação para contestar", "prazo para recurso"), sugira "prazoTipo" (nome curto do ato, ex.: "Contestação", "Recurso de Apelação", "Réplica", "Cumprimento de sentença"), "prazoDias" (número de dias, use o prazo padrão do CPC/CLT pra esse tipo de ato se a movimentação não informar o número exato) e "prazoDiasUteis" (true — CPC conta prazo em dias úteis, exceto quando a movimentação disser "dias corridos"). Se não for possível identificar um prazo processual claro, os três campos de prazo vêm null.

Responda SOMENTE um array JSON, na mesma ordem e mesma quantidade da lista, sem nenhum texto antes ou depois, no formato exato:
[{"requerAtencao":true,"prazoTipo":"Contestação","prazoDias":15,"prazoDiasUteis":true},{"requerAtencao":false,"prazoTipo":null,"prazoDias":null,"prazoDiasUteis":null}]

Movimentações:\n${lista}`;

    // Timeout explícito — sem isso, uma Anthropic lenta/travada pendura o sync inteiro (que já
    // percorre todos os processos da org, não é só 1 chamada).
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) return null;

    const body = await res.json();
    const texto = (body.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    const match = texto.match(/\[[\s\S]*\]/); // pega só o array, ignora qualquer texto extra que a IA cole em volta
    if (!match) return null;
    const resultado = JSON.parse(match[0]);
    if (!Array.isArray(resultado) || resultado.length !== nomes.length) return null;
    return resultado.map((r: any) => ({
      requerAtencao: Boolean(r?.requerAtencao),
      prazoTipo: typeof r?.prazoTipo === "string" ? r.prazoTipo : null,
      prazoDias: Number.isFinite(r?.prazoDias) ? r.prazoDias : null,
      prazoDiasUteis: typeof r?.prazoDiasUteis === "boolean" ? r.prazoDiasUteis : null,
    }));
  } catch {
    return null;
  }
}

async function sincronizarProcesso(admin: ReturnType<typeof createClient>, processo: any, apiKey: string, termos: string[], anthropicKey: string | undefined) {
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
    let movimentos: any[] = hit?.movimentos ?? [];
    let viaEscavador = false;

    // DataJud não achou (limitação real da base pública, ver comentário em
    // consultaEscavador) — tenta a Escavador como 2ª fonte, só se a org já tiver conectado.
    if (movimentos.length === 0) {
      const { data: integ } = await admin.from("integracoes").select("escavador_token").eq("org_id", processo.org_id).maybeSingle();
      if (integ?.escavador_token) {
        const viaEsc = await consultaEscavador(numeroLimpo, integ.escavador_token);
        if (viaEsc && viaEsc.length > 0) { movimentos = viaEsc; viaEscavador = true; }
      }
    }

    const { data: existentes } = await admin
      .from("movimentacoes_processo")
      .select("dedup_key")
      .eq("processo_id", processo.id);
    const jaConhecidos = new Set((existentes ?? []).map((m) => m.dedup_key));

    const novos = movimentos
      .map((m) => ({ ...m, _key: dedupKey(m.nome ?? "", m.dataHora ?? "") }))
      .filter((m) => !jaConhecidos.has(m._key));

    // 1 chamada de IA pra todas as movimentações novas DESSE processo de uma vez, não uma
    // por movimentação — resultado null (sem chave, ou a IA falhou) cai pra só palavra-chave
    // (sem prazo sugerido, mas o requer_atencao continua funcionando).
    const nomesNovos = novos.map((m) => m.nome ?? "Movimentação sem nome");
    const classificacaoIA = anthropicKey && nomesNovos.length > 0
      ? await classificarComIA(nomesNovos, anthropicKey)
      : null;

    let novosMovimentos = 0;
    for (let i = 0; i < novos.length; i++) {
      const m = novos[i];
      const nome: string = m.nome ?? "Movimentação sem nome";
      const requerAtencaoPalavraChave = termos.some((t) => nome.toLowerCase().includes(t.toLowerCase()));
      const c = classificacaoIA?.[i];
      const requerAtencao = requerAtencaoPalavraChave || (c?.requerAtencao ?? false);

      const { data: inserted, error: insErr } = await admin.from("movimentacoes_processo").insert({
        org_id: processo.org_id,
        processo_id: processo.id,
        nome,
        data_hora: m.dataHora,
        complemento: m.complementosTabelados ?? null,
        requer_atencao: requerAtencao,
        dedup_key: m._key,
        prazo_sugerido_tipo: c?.prazoTipo ?? null,
        prazo_sugerido_dias: c?.prazoDias ?? null,
        prazo_sugerido_dias_uteis: c?.prazoDiasUteis ?? null,
      }).select("id").single();
      if (insErr) continue; // conflito de dedup_key concorrente, ou outro erro pontual — segue o baile
      novosMovimentos++;

      if (movimentacaoRecente(m.dataHora)) {
        await admin.from("notificacoes").insert({
          org_id: processo.org_id,
          processo_id: processo.id,
          movimentacao_id: inserted.id,
          tipo: "movimentacao",
          titulo: `Nova movimentação — processo ${processo.numero}`,
          texto: c?.prazoTipo ? `${nome} — IA sugere prazo: ${c.prazoTipo}, ${c.prazoDias} dias${c.prazoDiasUteis ? " úteis" : " corridos"}` : nome,
          requer_atencao: requerAtencao,
        });
      }
    }

    await admin.from("processos").update({
      tribunal_alias: alias,
      datajud_status: "ok",
      datajud_erro: null,
      ultima_verificacao_datajud: new Date().toISOString(),
    }).eq("id", processo.id);

    return { id: processo.id, status: "ok" as const, novosMovimentos, fonte: viaEscavador ? "escavador" : "datajud" };
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
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY"); // opcional — sem ela, só palavra-chave

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
      resultados.push(await sincronizarProcesso(admin, p, apiKey, termos, anthropicKey));
    }

    const resumo = {
      processados: resultados.length,
      ok: resultados.filter((r) => r.status === "ok").length,
      erros: resultados.filter((r) => r.status === "erro").length,
      nao_suportados: resultados.filter((r) => r.status === "nao_suportado").length,
      novos_movimentos: resultados.reduce((s, r: any) => s + (r.novosMovimentos ?? 0), 0),
      via_escavador: resultados.filter((r: any) => r.fonte === "escavador").length,
    };
    return new Response(JSON.stringify({ ok: true, ...resumo, detalhes: resultados }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
