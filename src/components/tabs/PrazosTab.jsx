import React, { useMemo, useState } from "react";
import { Clock, Plus, ChevronLeft, ChevronRight, List, CalendarDays } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import Stamp, { urgencia } from "../Stamp.jsx";
import RowActions from "../RowActions.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import { COLORS } from "../../lib/theme.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";

const diasAte = (data) => Math.ceil((new Date(`${data}T00:00:00`) - new Date(new Date().toDateString())) / 86400000);
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

function linhaPrazo(p, onEdit, onDelete) {
  const dias = diasAte(p.data);
  const u = urgencia(dias);
  return (
    <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderTop: `1px solid ${COLORS.line}` }}>
      <div className="min-w-0">
        <p className="text-sm truncate" style={{ color: COLORS.ink, fontWeight: 600 }}>{p.tipo}</p>
        <p className="text-xs truncate" style={{ color: COLORS.slate }}>{p.processo?.numero ?? "—"} · {p.processo?.cliente?.nome ?? "—"} · {p.responsavel?.nome ?? "sem responsável"}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Stamp tone={u.tone}>{u.label} · {dias}d</Stamp>
        <RowActions onEdit={() => onEdit(p)} onDelete={() => onDelete(p.id)} />
      </div>
    </div>
  );
}

function CalendarioPrazos({ prazos, onEdit, onDelete }) {
  const [mesRef, setMesRef] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  const porDia = useMemo(() => {
    const map = new Map();
    for (const p of prazos) {
      if (!map.has(p.data)) map.set(p.data, []);
      map.get(p.data).push(p);
    }
    return map;
  }, [prazos]);

  const ano = mesRef.getFullYear(), mes = mesRef.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const celulas = [
    ...Array.from({ length: primeiroDiaSemana }, () => null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];
  const hojeStr = new Date().toISOString().slice(0, 10);

  const dataStr = (dia) => `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMesRef(new Date(ano, mes - 1, 1))} className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.slate }}><ChevronLeft size={16} /></button>
          <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 600, color: COLORS.ink }}>
            {mesRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
          <button onClick={() => setMesRef(new Date(ano, mes + 1, 1))} className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.slate }}><ChevronRight size={16} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1" style={{ color: COLORS.slate }}>
          {DIAS_SEMANA.map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {celulas.map((dia, i) => {
            if (!dia) return <div key={i} />;
            const ds = dataStr(dia);
            const doDia = porDia.get(ds) ?? [];
            const piorTone = doDia.reduce((pior, p) => {
              const t = urgencia(diasAte(p.data)).tone;
              const ordem = { urgent: 2, warn: 1, ok: 0 };
              return ordem[t] > (ordem[pior] ?? -1) ? t : pior;
            }, null);
            const corPonto = piorTone === "urgent" ? COLORS.wine : piorTone === "warn" ? COLORS.brass : piorTone === "ok" ? COLORS.success : null;
            const selecionado = diaSelecionado === ds;
            return (
              <button
                key={i}
                onClick={() => setDiaSelecionado(selecionado ? null : ds)}
                className="aspect-square rounded-md flex flex-col items-center justify-center text-xs relative"
                style={{
                  background: selecionado ? COLORS.ink : ds === hojeStr ? "rgba(165,121,59,0.12)" : "transparent",
                  color: selecionado ? "#fff" : COLORS.ink,
                  border: ds === hojeStr && !selecionado ? `1px solid ${COLORS.brass}` : "1px solid transparent",
                }}
              >
                {dia}
                {corPonto && (
                  <span className="absolute bottom-1 rounded-full" style={{ width: 5, height: 5, background: selecionado ? "#fff" : corPonto }} />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden !p-0">
        <p className="px-4 py-3 text-sm font-semibold" style={{ color: COLORS.ink, borderBottom: `1px solid ${COLORS.line}` }}>
          {diaSelecionado ? new Date(`${diaSelecionado}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : "Clique num dia com marcação"}
        </p>
        {diaSelecionado && (porDia.get(diaSelecionado) ?? []).length === 0 && (
          <p className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>Nenhum prazo nesse dia.</p>
        )}
        {!diaSelecionado && (
          <p className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>Os dias com bolinha têm prazo cadastrado.</p>
        )}
        {(diaSelecionado ? porDia.get(diaSelecionado) ?? [] : []).map((p) => linhaPrazo(p, onEdit, onDelete))}
      </Card>
    </div>
  );
}

export default function PrazosTab() {
  const { data: prazos, loading, insert, update, remove } = useSupabaseTable("prazos", {
    select: "*, processo:processos(id,numero,cliente:clientes(nome)), responsavel:profiles(id,nome)",
  });
  const { data: processos } = useSupabaseTable("processos", { select: "id,numero", orderBy: "numero", ascending: true });
  const { data: equipe } = useSupabaseTable("profiles", { select: "id,nome", orderBy: "nome", ascending: true });
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState("lista"); // "lista" | "calendario"

  // "Data" pode ser digitada direto (prazo simples) OU calculada a partir de início +
  // quantidade de dias (dias_uteis pula sábado/domingo/feriado nacional) — se início e
  // quantidade vierem preenchidos, o banco recalcula "data" sozinho (trigger set_prazo_data),
  // ignorando o que foi digitado direto nela.
  const fields = useMemo(() => [
    { key: "processo_id", label: "Processo", type: "select", options: processos.map((p) => ({ value: p.id, label: p.numero })) },
    { key: "tipo", label: "Tipo de prazo" },
    { key: "data", label: "Data (ou preencha início+quantidade abaixo pra calcular)", type: "date", optional: true },
    { key: "data_inicio", label: "— OU: início da contagem", type: "date", optional: true },
    { key: "dias_uteis", label: "Contagem", type: "select", optional: true, options: [{ value: "true", label: "Dias úteis" }, { value: "false", label: "Dias corridos" }] },
    { key: "quantidade_dias", label: "Quantidade de dias", type: "number", optional: true },
    { key: "alerta_dias_antes", label: "Avisar quantos dias úteis antes de vencer", type: "number", optional: true },
    { key: "responsavel_id", label: "Responsável", type: "select", options: equipe.map((e) => ({ value: e.id, label: e.nome })), optional: true },
  ], [processos, equipe]);

  const abrirEdicao = (p) => setEditing({ ...p, processo_id: p.processo?.id, responsavel_id: p.responsavel?.id });
  const sorted = [...prazos].sort((a, b) => diasAte(a.data) - diasAte(b.data));

  return (
    <div>
      <SectionTitle
        icon={Clock}
        title="Prazos"
        subtitle="Próximos vencimentos, do mais urgente ao mais distante"
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${COLORS.line}` }}>
              <button onClick={() => setView("lista")} className="p-2" style={{ background: view === "lista" ? COLORS.ink : "transparent", color: view === "lista" ? "#fff" : COLORS.slate }} aria-label="Lista">
                <List size={14} />
              </button>
              <button onClick={() => setView("calendario")} className="p-2" style={{ background: view === "calendario" ? COLORS.ink : "transparent", color: view === "calendario" ? "#fff" : COLORS.slate }} aria-label="Calendário">
                <CalendarDays size={14} />
              </button>
            </div>
            <button onClick={() => setEditing({})} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
              <Plus size={14} /> Novo
            </button>
          </div>
        }
      />

      {view === "calendario" ? (
        <CalendarioPrazos prazos={prazos} onEdit={abrirEdicao} onDelete={remove} />
      ) : (
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: COLORS.ink }}>
                {["Processo", "Cliente", "Tipo", "Data", "Responsável", "Situação", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11, letterSpacing: "0.06em" }}>
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>Nenhum prazo cadastrado ainda.</td></tr>
              )}
              {sorted.map((p, i) => {
                const dias = diasAte(p.data);
                const u = urgencia(dias);
                return (
                  <tr key={p.id} style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
                    <td className="px-4 py-3" style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.inkSoft, fontSize: 12.5 }}>{p.processo?.numero ?? "—"}</td>
                    <td className="px-4 py-3" style={{ color: COLORS.ink }}>{p.processo?.cliente?.nome ?? "—"}</td>
                    <td className="px-4 py-3" style={{ color: COLORS.slate }}>{p.tipo}</td>
                    <td className="px-4 py-3" style={{ color: COLORS.slate }}>{new Date(`${p.data}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3" style={{ color: COLORS.slate }}>{p.responsavel?.nome ?? "—"}</td>
                    <td className="px-4 py-3"><Stamp tone={u.tone}>{u.label} · {dias}d</Stamp></td>
                    <td className="px-4 py-3">
                      <RowActions onEdit={() => abrirEdicao(p)} onDelete={() => remove(p.id)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <RecordFormModal
        open={editing !== null}
        title={editing?.id ? "Editar prazo" : "Novo prazo"}
        fields={fields}
        initialValues={editing}
        onClose={() => setEditing(null)}
        onSubmit={({ dias_uteis, quantidade_dias, alerta_dias_antes, ...values }) => {
          const payload = {
            ...values,
            ...(dias_uteis !== null && { dias_uteis: dias_uteis === "true" }),
            ...(quantidade_dias !== null && { quantidade_dias: parseInt(quantidade_dias, 10) }),
            ...(alerta_dias_antes !== null && { alerta_dias_antes: parseInt(alerta_dias_antes, 10) }),
          };
          return editing?.id ? update(editing.id, payload) : insert(payload);
        }}
      />
    </div>
  );
}
