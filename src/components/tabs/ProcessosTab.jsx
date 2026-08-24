import React, { useMemo, useState } from "react";
import { Briefcase, Plus, AlertTriangle, RefreshCw } from "lucide-react";
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

const STATUS_TONE = { "Em andamento": "ok", "Aguardando decisão": "warn", "Suspenso": "neutral", "Encerrado": "neutral" };
const STATUS_OPTIONS = Object.keys(STATUS_TONE).map((s) => ({ value: s, label: s }));

const PRAZO_FIELDS = [
  { key: "tipo", label: "Tipo de prazo (ex: Contestação, Recurso)" },
  { key: "data_inicio", label: "Início da contagem", type: "date" },
  { key: "dias_uteis", label: "Contagem", type: "select", options: [{ value: "true", label: "Dias úteis" }, { value: "false", label: "Dias corridos" }] },
  { key: "quantidade_dias", label: "Quantidade de dias", type: "number" },
  { key: "alerta_dias_antes", label: "Avisar quantos dias úteis antes de vencer", type: "number", optional: true },
];

export default function ProcessosTab({ currentRole, orgId, profile }) {
  // orgId só vem preenchido quando o platform admin "entrou" numa empresa alheia — filtra
  // explicitamente porque a RLS libera geral pra ele, não fica restrita a uma org só.
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: processos, loading, insert, update, remove } = useSupabaseTable("processos", {
    select: "*, cliente:clientes(id,nome), responsavel:profiles(id,nome)", eq: orgEq,
  });
  const { data: clientes } = useSupabaseTable("clientes", { select: "id,nome", orderBy: "nome", ascending: true, eq: orgEq });
  const { data: equipe } = useSupabaseTable("profiles", { select: "id,nome", orderBy: "nome", ascending: true, eq: orgEq });
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
    { key: "numero", label: "Número do processo (formato CNJ p/ sincronizar com o DataJud)" },
    { key: "cliente_id", label: "Cliente", type: "select", options: clientes.map((c) => ({ value: c.id, label: c.nome })) },
    { key: "area", label: "Área do direito", type: "datalist", options: AREAS_DIREITO_COMUNS.map((a) => ({ value: a })) },
    { key: "status", label: "Situação", type: "select", options: STATUS_OPTIONS },
    { key: "valor", label: "Valor da causa (R$)", type: "number", optional: true },
    { key: "responsavel_id", label: "Responsável", type: "select", options: equipe.map((e) => ({ value: e.id, label: e.nome })), optional: true },
  ], [clientes, equipe]);

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

  const abrirRegistrarPrazo = (processoId) => (mov) => setRegistrandoPrazo({
    processo_id: processoId,
    movimentacao_origem_id: mov.id,
    data_inicio: mov.data_hora.slice(0, 10),
    dias_uteis: "true",
    tipo: mov.nome,
  });

  if (processoAberto) {
    // Processo pode ter sido atualizado (editar) desde que a página abriu — pega a versão
    // mais fresca da lista já carregada, cai no que tinha se ainda não sincronizou.
    const atual = processos.find((p) => p.id === processoAberto.id) ?? processoAberto;
    return (
      <>
        <ProcessoPagina
          processo={atual}
          atrasos={clientesInadimplentes.get(atual.cliente?.id)}
          equipe={equipe}
          orgId={orgId}
          profile={profile}
          onVoltar={() => setProcessoAberto(null)}
          onEditar={() => setEditing({ ...atual, cliente_id: atual.cliente?.id, responsavel_id: atual.responsavel?.id })}
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
          onSubmit={(values) => (editing?.id ? update(editing.id, values) : insert(values))}
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
            <button onClick={() => setEditing({})} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
              <Plus size={14} /> Novo
            </button>
          </div>
        }
      />
      {!loading && processosFiltrados.length === 0 && (
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
                <p className="mt-1 text-lg" style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600 }}>{p.cliente?.nome ?? "—"}</p>
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
              <span className="text-xs uppercase tracking-wide" style={{ color: COLORS.brass, fontWeight: 600 }}>{p.area}</span>
              <span className="text-sm" style={{ color: COLORS.slate }}>{p.responsavel?.nome ?? "—"}</span>
              <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>{p.valor ? p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</span>
            </div>
            <div className="flex items-center justify-end mt-2" onClick={(e) => e.stopPropagation()}>
              <RowActions
                onEdit={() => setEditing({ ...p, cliente_id: p.cliente?.id, responsavel_id: p.responsavel?.id })}
                onDelete={() => remove(p.id)}
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
        onSubmit={(values) => (editing?.id ? update(editing.id, values) : insert(values))}
      />
    </div>
  );
}
