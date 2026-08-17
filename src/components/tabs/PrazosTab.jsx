import React, { useMemo, useState } from "react";
import { Clock, Plus } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import Stamp, { urgencia } from "../Stamp.jsx";
import RowActions from "../RowActions.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import { COLORS } from "../../lib/theme.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";

const diasAte = (data) => Math.ceil((new Date(`${data}T00:00:00`) - new Date(new Date().toDateString())) / 86400000);

export default function PrazosTab() {
  const { data: prazos, loading, insert, update, remove } = useSupabaseTable("prazos", {
    select: "*, processo:processos(id,numero,cliente:clientes(nome)), responsavel:profiles(id,nome)",
  });
  const { data: processos } = useSupabaseTable("processos", { select: "id,numero", orderBy: "numero", ascending: true });
  const { data: equipe } = useSupabaseTable("profiles", { select: "id,nome", orderBy: "nome", ascending: true });
  const [editing, setEditing] = useState(null);

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

  const sorted = [...prazos].sort((a, b) => diasAte(a.data) - diasAte(b.data));

  return (
    <div>
      <SectionTitle
        icon={Clock}
        title="Prazos"
        subtitle="Próximos vencimentos, do mais urgente ao mais distante"
        action={
          <button onClick={() => setEditing({})} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
            <Plus size={14} /> Novo
          </button>
        }
      />
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
                    <RowActions
                      onEdit={() => setEditing({ ...p, processo_id: p.processo?.id, responsavel_id: p.responsavel?.id })}
                      onDelete={() => remove(p.id)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

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
