import React, { useMemo, useState } from "react";
import { Briefcase, Plus, AlertTriangle, RefreshCw, FileClock } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import Stamp from "../Stamp.jsx";
import RowActions from "../RowActions.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import MovimentacoesPanel from "../MovimentacoesPanel.jsx";
import SearchInput from "../SearchInput.jsx";
import { COLORS } from "../../lib/theme.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
import { supabase } from "../../lib/supabaseClient.js";

const STATUS_TONE = { "Em andamento": "ok", "Aguardando decisão": "warn", "Suspenso": "neutral", "Encerrado": "neutral" };
const STATUS_OPTIONS = Object.keys(STATUS_TONE).map((s) => ({ value: s, label: s }));

const PRAZO_FIELDS = [
  { key: "tipo", label: "Tipo de prazo (ex: Contestação, Recurso)" },
  { key: "data_inicio", label: "Início da contagem", type: "date" },
  { key: "dias_uteis", label: "Contagem", type: "select", options: [{ value: "true", label: "Dias úteis" }, { value: "false", label: "Dias corridos" }] },
  { key: "quantidade_dias", label: "Quantidade de dias", type: "number" },
  { key: "alerta_dias_antes", label: "Avisar quantos dias úteis antes de vencer", type: "number", optional: true },
];

export default function ProcessosTab({ currentRole, orgId }) {
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
  const [editing, setEditing] = useState(null);
  const [vendoAndamentos, setVendoAndamentos] = useState(null); // processo aberto no painel de andamentos
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
    { key: "area", label: "Área do direito" },
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
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.slate }}>{p.numero}</p>
                <p className="mt-1 text-lg" style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600 }}>{p.cliente?.nome ?? "—"}</p>
              </div>
              <Stamp tone={STATUS_TONE[p.status]}>{p.status}</Stamp>
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
            <div className="flex items-center justify-between mt-2">
              <button onClick={() => setVendoAndamentos(p)} className="flex items-center gap-1.5 text-xs underline" style={{ color: COLORS.slate }}>
                <FileClock size={13} /> Andamentos
                {p.datajud_status === "erro" && <AlertTriangle size={12} color={COLORS.wine} />}
              </button>
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

      {vendoAndamentos && (
        <MovimentacoesPanel
          processo={vendoAndamentos}
          onClose={() => setVendoAndamentos(null)}
          onRegistrarPrazo={(mov) => setRegistrandoPrazo({
            processo_id: vendoAndamentos.id,
            movimentacao_origem_id: mov.id,
            data_inicio: mov.data_hora.slice(0, 10),
            dias_uteis: "true",
            tipo: mov.nome,
          })}
        />
      )}

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
    </div>
  );
}
