import React, { useEffect, useMemo, useState } from "react";
import { Briefcase, Plus, AlertTriangle, RefreshCw, Lock } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import RowActions from "../RowActions.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import ProcessoPagina from "../ProcessoPagina.jsx";
import ProcessoBell from "../ProcessoBell.jsx";
import StatusPicker from "../StatusPicker.jsx";
import SearchInput from "../SearchInput.jsx";
import { COLORS } from "../../lib/theme.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
import { supabase } from "../../lib/supabaseClient.js";
import { AREAS_DIREITO_COMUNS } from "../../config/areasDireito.js";
import { avisoLimitePlano } from "../../lib/limitesPlano.js";
import { formatNumeroProcesso } from "../../lib/numeroProcesso.js";

const STATUS_TONE = { "Em andamento": "ok", "Aguardando decisão": "warn", "Suspenso": "neutral", "Encerrado": "neutral" };
const STATUS_OPTIONS = Object.keys(STATUS_TONE).map((s) => ({ value: s, label: s }));

// "responsaveis" (array de profile id) não é coluna de processos — vira linhas em
// processo_responsaveis à parte (ver salvarProcesso). Só limpa o resto e garante default.
function prepararValoresProcesso(values) {
  let v = values;
  // processos.valor é not null (default 0) — campo é opcional na tela, mas mandar null pro
  // banco quebra a constraint com um erro cru em vez do "opcional" que o form promete.
  if ("valor" in v && v.valor == null) v = { ...v, valor: 0 };
  return v;
}

// Junta o nome de todos os responsáveis (0+) com "Sócios" quando marcado — cobre os 3 estados
// possíveis: ninguém designado, 1+ pessoa nomeada, e/ou aberto pra todos os sócios.
function nomesResponsaveis(lista, socios) {
  const nomes = (lista ?? []).map((r) => r.nome);
  if (socios) nomes.push("Sócios");
  return nomes.length ? nomes.join(", ") : "—";
}

const PRAZO_FIELDS = [
  { key: "tipo", label: "Tipo de prazo (ex: Contestação, Recurso)" },
  { key: "data_inicio", label: "Início da contagem", type: "date" },
  { key: "dias_uteis", label: "Contagem", type: "select", options: [{ value: "true", label: "Dias úteis" }, { value: "false", label: "Dias corridos" }] },
  { key: "quantidade_dias", label: "Quantidade de dias", type: "number" },
  { key: "alerta_dias_antes", label: "Avisar quantos dias úteis antes de vencer", type: "number", optional: true },
];

export default function ProcessosTab({ currentRole, orgId, profile, abrirProcessoId, onAbriuProcesso }) {
  // orgId só vem preenchido quando o platform admin "entrou" numa empresa alheia — filtra
  // explicitamente porque a RLS libera geral pra ele, não fica restrita a uma org só.
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: processos, loading, error: erroProcessos, insert, update, remove, refresh: refreshProcessos } = useSupabaseTable("processos", {
    // FK explícito (!processos_responsavel_id_fkey): a tabela processo_responsaveis (ponytail,
    // dormant) criou um segundo caminho processos<->profiles, e sem isso o PostgREST recusa o
    // embed por ambiguidade ("more than one relationship was found").
    select: "*, cliente:clientes(id,nome), responsavel:profiles!processos_responsavel_id_fkey(id,nome)", eq: orgEq,
  });
  const { data: clientes } = useSupabaseTable("clientes", { select: "id,nome", orderBy: "nome", ascending: true, eq: orgEq });
  // role vem junto só pra filtrar admin fora do dropdown de Responsável — "Dev - adm" é a
  // conta de suporte, não alguém que carrega processo (ela já vê tudo por outra via).
  const { data: equipeRaw } = useSupabaseTable("profiles", { select: "id,nome,role", orderBy: "nome", ascending: true, eq: orgEq });
  const equipe = useMemo(() => equipeRaw.filter((e) => e.role !== "admin"), [equipeRaw]);
  // 1 processo pode ter mais de 1 responsável (processo_responsaveis) — sem `eq` aqui porque
  // a tabela não tem org_id próprio, a RLS já escopa pelo join com processos.org_id.
  const { data: responsaveisRaw, refresh: refreshResponsaveis } = useSupabaseTable("processo_responsaveis", {
    select: "processo_id, profile:profiles(id,nome)", orderBy: "processo_id", ascending: true,
  });
  const responsaveisPorProcesso = useMemo(() => {
    const map = new Map();
    for (const r of responsaveisRaw) {
      if (!map.has(r.processo_id)) map.set(r.processo_id, []);
      if (r.profile) map.get(r.processo_id).push(r.profile);
    }
    return map;
  }, [responsaveisRaw]);
  const { insert: insertPrazo } = useSupabaseTable("prazos", { eq: orgEq });
  // Sem módulo financeiro liberado pro perfil, a RLS de honorarios devolve vazio — o aviso
  // só aparece pra quem já enxerga essa informação de qualquer forma.
  const { data: honorarios } = useSupabaseTable("honorarios", { select: "cliente_id, status, vencimento", eq: orgEq });
  const { data: notificacoes, refresh: refreshNotificacoes } = useSupabaseTable("notificacoes", { select: "id, processo_id, titulo, lida, created_at", eq: orgEq });
  const notificacoesPorProcesso = useMemo(() => {
    const map = new Map();
    for (const n of notificacoes) {
      if (!n.processo_id) continue;
      if (!map.has(n.processo_id)) map.set(n.processo_id, []);
      map.get(n.processo_id).push(n);
    }
    return map;
  }, [notificacoes]);
  const [editing, setEditing] = useState(null);
  const [processoAberto, setProcessoAberto] = useState(null); // processo aberto na página cheia (card clicado)
  const [registrandoPrazo, setRegistrandoPrazo] = useState(null); // {processo_id, movimentacao_origem_id, data_inicio, tipo}
  const [sincronizando, setSincronizando] = useState(false);
  const [busca, setBusca] = useState("");

  const podeSincronizar = currentRole === "admin" || currentRole === "socio";

  // Limite do plano conta só processo ATIVO (mesma regra da RLS processos_ins) — arquivado
  // não deveria travar a criação de um novo.
  const abrirNovoProcesso = () => {
    const ativos = processos.filter((p) => p.status !== "Encerrado").length;
    const aviso = avisoLimitePlano(profile?.organizations, "limite_processos", ativos, "processos ativos");
    if (aviso) return alert(aviso);
    setEditing({});
  };

  // Constraint unique (org_id, numero) já barra duplicado no banco — aqui só troca o erro
  // cru do Postgres (23505) por uma mensagem que faz sentido pra quem tá preenchendo o form.
  //
  // "responsaveis" não é coluna de processos — é a lista (0+ pessoas) que vira linhas em
  // processo_responsaveis à parte. Salva o processo primeiro, depois substitui o conjunto de
  // responsáveis inteiro (apaga tudo que tinha e insere o que foi marcado); o trigger
  // sincroniza_responsavel_principal cuida sozinho de manter responsavel_id ("principal",
  // usado por set_prazo_data/ExecutivoTab) em dia a partir disso.
  const salvarProcesso = async (values) => {
    const { responsaveis, ...resto } = values;
    const v = prepararValoresProcesso(resto);
    let processoId = editing?.id;
    // Processo novo já nasce com id gerado aqui, e o insert pula o RETURNING (semSelect) —
    // se o processo nascer confidencial sem "Sócios" marcado, na hora do INSERT ainda não
    // existe linha em processo_responsaveis pra ele; com RETURNING, a RLS de processos_sel
    // roda DENTRO do próprio insert pra reler a linha, não passa (criador ainda não é
    // responsável de nada) e o Postgres derruba o INSERT INTEIRO com "new row violates row-
    // level security policy" — mesmo já tendo passado no WITH CHECK. Sem select() depois do
    // insert, isso não acontece; sabendo o id de antemão (gerado aqui), também não
    // precisamos ler a linha de volta pra saber o id.
    if (!processoId) { processoId = crypto.randomUUID(); v.id = processoId; }
    try {
      if (editing?.id) await update(processoId, v);
      else await insert(v, { semSelect: true });
    } catch (err) {
      if (err.code === "23505") throw new Error(`Já existe um processo cadastrado com o número "${v.numero}".`);
      throw err;
    }
    // Diff em vez de apagar tudo e recriar: apagar+inserir de novo o mesmo conjunto conta
    // como "adicionar" pra RLS (processo_responsaveis_ins exige sócio/admin em processo
    // confidencial) — travava até quem já era responsável legítimo só de reabrir e salvar o
    // form sem mexer em Responsáveis. Só toca quem de fato mudou.
    const atuais = new Set((responsaveisPorProcesso.get(processoId) ?? []).map((r) => r.id));
    const novos = new Set(responsaveis ?? []);
    const remover = [...atuais].filter((id) => !novos.has(id));
    const adicionar = [...novos].filter((id) => !atuais.has(id));
    if (remover.length) {
      const { error: errDel } = await supabase.from("processo_responsaveis").delete().eq("processo_id", processoId).in("profile_id", remover);
      if (errDel) throw new Error(`Processo salvo, mas não deu pra atualizar os responsáveis: ${errDel.message}`);
    }
    if (adicionar.length) {
      const { error: errIns } = await supabase.from("processo_responsaveis").insert(adicionar.map((profile_id) => ({ processo_id: processoId, profile_id })));
      if (errIns) throw new Error(`Processo salvo, mas não deu pra gravar os responsáveis: ${errIns.message}`);
    }
    await refreshResponsaveis();
    // insert()/update() já rodam seu próprio refresh, mas pra um processo confidencial
    // criado agora, aquele refresh aconteceu ANTES de existir responsável — o processo
    // ficaria fora da lista local até esse segundo refresh, de novo já com o responsável
    // gravado.
    await refreshProcessos();
  };

  // <main> (App.jsx) é quem rola, não a window — sem isso, abrir/fechar a página cheia do
  // processo mantém a posição de rolagem de antes, e o botão "Voltar" (que fica no topo)
  // sai da tela. Parecia bug de clique; era só a rolagem não voltando pro topo.
  useEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
  }, [processoAberto]);

  // Deep-link vindo da página do Cliente ("clicar num processo dele" — ver ClientePagina.jsx
  // e App.jsx): assim que a lista carrega, se tiver um id pendente, já abre a página cheia
  // daquele processo e avisa o App.jsx que já abriu (senão reabriria de novo à toa depois).
  useEffect(() => {
    if (!abrirProcessoId || processos.length === 0) return;
    const alvo = processos.find((p) => p.id === abrirProcessoId);
    if (alvo) setProcessoAberto(alvo);
    onAbriuProcesso?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirProcessoId, processos]);

  const processosFiltrados = processos.filter((p) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return p.numero.toLowerCase().includes(q) || (p.cliente?.nome || "").toLowerCase().includes(q) || p.area.toLowerCase().includes(q);
  });

  // Inadimplente = tem honorário vencido, ou "em aberto" com vencimento já passado
  // (cobre o caso de ninguém ter marcado como "Vencido" manualmente ainda).
  const clientesInadimplentes = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const map = new Map();
    for (const h of honorarios) {
      const atrasado = h.status === "Vencido" || (h.status === "Em aberto" && h.vencimento < hoje);
      if (atrasado) map.set(h.cliente_id, (map.get(h.cliente_id) ?? 0) + 1);
    }
    return map;
  }, [honorarios]);

  const fields = useMemo(() => [
    { key: "numero", label: "Número do processo (formato CNJ p/ sincronizar com o DataJud)", mask: (raw) => formatNumeroProcesso(raw) },
    { key: "cliente_id", label: "Cliente", type: "select", options: clientes.map((c) => ({ value: c.id, label: c.nome })) },
    { key: "area", label: "Área do direito", type: "datalist", options: AREAS_DIREITO_COMUNS.map((a) => ({ value: a })) },
    { key: "status", label: "Situação", type: "select", options: STATUS_OPTIONS },
    { key: "valor", label: "Valor da causa (R$)", type: "number", optional: true },
    // 1 processo pode ter mais de 1 advogado responsável (processo_responsaveis) — advogado
    // só vê/edita o que estiver aqui (qualquer um da lista, não só "o principal"). Vazio =
    // sem responsável designado ainda.
    { key: "responsaveis", label: "Responsáveis", type: "multiselect", options: equipe.map((e) => ({ value: e.id, label: e.nome })) },
    // Sigilo — só sócio/admin decide. RLS (processos_sel/upd/del) restringe visão E edição:
    // "Confidencial" sozinho vale só pra quem tá em Responsáveis; "Visível pra todos os
    // sócios" abre pra qualquer sócio mesmo sem estar listado (financeiro do processo
    // confidencial segue junto — honorarios_sel). Pedido do usuário, versão sem repetir o
    // incidente: só entra em vigor quando alguém liga isso à mão.
    ...(currentRole === "admin" || currentRole === "socio"
      ? [
          { key: "confidencial", label: "Confidencial — só quem está em Responsáveis enxerga (processo e financeiro)", type: "checkbox" },
          { key: "responsavel_socios", label: "Visível pra todos os sócios (mesmo sem estar em Responsáveis)", type: "checkbox" },
        ]
      : []),
  ], [clientes, equipe, currentRole]);

  const sincronizarDatajud = async () => {
    setSincronizando(true);
    const { data, error } = await supabase.functions.invoke("datajud-sync", { body: {} });
    setSincronizando(false);
    if (error) {
      const body = await error.context?.json?.().catch(() => null);
      alert(body?.error ?? error.message);
      return;
    }
    alert(`Sincronizado: ${data.ok}/${data.processados} processo(s) ok, ${data.novos_movimentos} movimentação(ões) nova(s).`);
  };

  // Pré-preenche com a sugestão da IA (tipo/dias/dias_uteis) quando tem — advogado ainda
  // confirma/ajusta antes de salvar, IA só poupa o preenchimento manual (ver
  // classificarComIA em datajud-sync/index.ts, comparado com o Legal One no ROADMAP-comparativo.md).
  const abrirRegistrarPrazo = (processoId) => (mov) => setRegistrandoPrazo({
    processo_id: processoId,
    movimentacao_origem_id: mov.id,
    data_inicio: mov.data_hora.slice(0, 10),
    dias_uteis: mov.prazo_sugerido_dias_uteis === false ? "false" : "true",
    tipo: mov.prazo_sugerido_tipo || mov.nome,
    quantidade_dias: mov.prazo_sugerido_dias ?? "",
  });

  if (processoAberto) {
    // Processo pode ter sido atualizado (editar) desde que a página abriu — pega a versão
    // mais fresca da lista já carregada, cai no que tinha se ainda não sincronizou.
    const atual = processos.find((p) => p.id === processoAberto.id) ?? processoAberto;
    return (
      <>
        <ProcessoPagina
          processo={atual}
          responsaveis={responsaveisPorProcesso.get(atual.id)}
          atrasos={clientesInadimplentes.get(atual.cliente?.id)}
          equipe={equipe}
          orgId={orgId}
          profile={profile}
          onVoltar={() => setProcessoAberto(null)}
          onEditar={() => setEditing({ ...atual, cliente_id: atual.cliente?.id, responsaveis: (responsaveisPorProcesso.get(atual.id) ?? []).map((r) => r.id) })}
          onExcluir={() => { remove(atual.id); setProcessoAberto(null); }}
          onRegistrarPrazo={abrirRegistrarPrazo(atual.id)}
          onMudarStatus={(status) => update(atual.id, { status })}
        />
        <RecordFormModal
          open={editing !== null}
          title={editing?.id ? "Editar processo" : "Novo processo"}
          fields={fields}
          initialValues={editing}
          onClose={() => setEditing(null)}
          onSubmit={salvarProcesso}
        />
        <RecordFormModal
          open={registrandoPrazo !== null}
          title="Registrar prazo a partir da movimentação"
          fields={PRAZO_FIELDS}
          initialValues={registrandoPrazo}
          onClose={() => setRegistrandoPrazo(null)}
          onSubmit={(values) => insertPrazo({
            ...values,
            dias_uteis: values.dias_uteis === "true",
            quantidade_dias: parseInt(values.quantidade_dias, 10),
            alerta_dias_antes: values.alerta_dias_antes ? parseInt(values.alerta_dias_antes, 10) : 3,
            processo_id: registrandoPrazo.processo_id,
            movimentacao_origem_id: registrandoPrazo.movimentacao_origem_id,
          })}
        />
      </>
    );
  }

  return (
    <div>
      <SectionTitle
        icon={Briefcase}
        title="Processos"
        subtitle="Casos ativos do escritório"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar processo ou cliente..." />
            {podeSincronizar && (
              <button onClick={sincronizarDatajud} disabled={sincronizando} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, opacity: sincronizando ? 0.6 : 1 }}>
                <RefreshCw size={14} className={sincronizando ? "animate-spin" : ""} /> {sincronizando ? "Sincronizando..." : "Sincronizar DataJud"}
              </button>
            )}
            <button onClick={abrirNovoProcesso} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
              <Plus size={14} /> Novo
            </button>
          </div>
        }
      />
      {erroProcessos && (
        <p className="text-sm mb-3 px-3 py-2 rounded-md" style={{ color: COLORS.wine, background: "rgba(155,28,28,0.08)" }}>
          Não deu pra carregar os processos ({erroProcessos}). Tente atualizar a página; se persistir, saia e entre de novo.
        </p>
      )}
      {!loading && !erroProcessos && processosFiltrados.length === 0 && (
        <p className="text-sm" style={{ color: COLORS.slate }}>{busca ? "Nenhum processo encontrado." : "Nenhum processo cadastrado ainda."}</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {processosFiltrados.map((p) => {
          const atrasos = clientesInadimplentes.get(p.cliente?.id);
          return (
          <Card key={p.id} hoverable className="cursor-pointer" onClick={() => setProcessoAberto(p)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.slate }}>{p.numero}</p>
                <p className="mt-1 text-lg flex items-center gap-1.5" style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600 }}>
                  {p.cliente?.nome ?? "—"}
                  {p.confidencial && <Lock size={13} color={COLORS.brassText} aria-label="Confidencial" />}
                </p>
              </div>
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                {p.datajud_status === "erro" && <AlertTriangle size={14} color={COLORS.wine} />}
                <ProcessoBell notificacoes={notificacoesPorProcesso.get(p.id) ?? []} onMudou={refreshNotificacoes} />
                <StatusPicker value={p.status} options={STATUS_OPTIONS.map((s) => s.value)} tone={STATUS_TONE} onChange={(status) => update(p.id, { status })} />
              </div>
            </div>
            {atrasos > 0 && (
              <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-md text-xs" style={{ background: "rgba(155,28,28,0.08)", color: COLORS.wine }}>
                <AlertTriangle size={13} />
                Cliente com {atrasos} honorário{atrasos > 1 ? "s" : ""} em atraso
              </div>
            )}
            <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: `1px solid ${COLORS.line}` }}>
              <span className="text-xs uppercase tracking-wide" style={{ color: COLORS.brassText, fontWeight: 600 }}>{p.area}</span>
              <span className="text-sm" style={{ color: COLORS.slate }}>
                {nomesResponsaveis(responsaveisPorProcesso.get(p.id), p.responsavel_socios)}
              </span>
              <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>{p.valor ? p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</span>
            </div>
            <div className="flex items-center justify-end mt-2" onClick={(e) => e.stopPropagation()}>
              <RowActions
                onEdit={() => setEditing({ ...p, cliente_id: p.cliente?.id, responsaveis: (responsaveisPorProcesso.get(p.id) ?? []).map((r) => r.id) })}
                onDelete={() => remove(p.id)}
                confirmLabel={p.numero}
                confirmCampo="o número do processo"
              />
            </div>
          </Card>
          );
        })}
      </div>

      <RecordFormModal
        open={editing !== null}
        title={editing?.id ? "Editar processo" : "Novo processo"}
        fields={fields}
        initialValues={editing}
        onClose={() => setEditing(null)}
        onSubmit={salvarProcesso}
      />
    </div>
  );
}
