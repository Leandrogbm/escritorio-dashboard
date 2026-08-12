import React, { useMemo, useState } from "react";
import { Briefcase, Plus } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import Stamp from "../Stamp.jsx";
import RowActions from "../RowActions.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import { COLORS } from "../../lib/theme.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";

const STATUS_TONE = { "Em andamento": "ok", "Aguardando decisão": "warn", "Suspenso": "neutral", "Encerrado": "neutral" };
const STATUS_OPTIONS = Object.keys(STATUS_TONE).map((s) => ({ value: s, label: s }));

export default function ProcessosTab() {
  const { data: processos, loading, insert, update, remove } = useSupabaseTable("processos", {
    select: "*, cliente:clientes(id,nome), responsavel:profiles(id,nome)",
  });
  const { data: clientes } = useSupabaseTable("clientes", { select: "id,nome", orderBy: "nome", ascending: true });
  const { data: equipe } = useSupabaseTable("profiles", { select: "id,nome", orderBy: "nome", ascending: true });
  const [editing, setEditing] = useState(null);

  const fields = useMemo(() => [
    { key: "numero", label: "Número do processo" },
    { key: "cliente_id", label: "Cliente", type: "select", options: clientes.map((c) => ({ value: c.id, label: c.nome })) },
    { key: "area", label: "Área do direito" },
    { key: "status", label: "Situação", type: "select", options: STATUS_OPTIONS },
    { key: "valor", label: "Valor da causa (R$)", type: "number", optional: true },
    { key: "responsavel_id", label: "Responsável", type: "select", options: equipe.map((e) => ({ value: e.id, label: e.nome })), optional: true },
  ], [clientes, equipe]);

  return (
    <div>
      <SectionTitle
        icon={Briefcase}
        title="Processos"
        subtitle="Casos ativos do escritório"
        action={
          <button onClick={() => setEditing({})} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
            <Plus size={14} /> Novo
          </button>
        }
      />
      {!loading && processos.length === 0 && (
        <p className="text-sm" style={{ color: COLORS.slate }}>Nenhum processo cadastrado ainda.</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {processos.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.slate }}>{p.numero}</p>
                <p className="mt-1 text-lg" style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600 }}>{p.cliente?.nome ?? "—"}</p>
              </div>
              <Stamp tone={STATUS_TONE[p.status]}>{p.status}</Stamp>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: `1px solid ${COLORS.line}` }}>
              <span className="text-xs uppercase tracking-wide" style={{ color: COLORS.brass, fontWeight: 600 }}>{p.area}</span>
              <span className="text-sm" style={{ color: COLORS.slate }}>{p.responsavel?.nome ?? "—"}</span>
              <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>{p.valor ? p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</span>
            </div>
            <div className="flex justify-end mt-2">
              <RowActions
                onEdit={() => setEditing({ ...p, cliente_id: p.cliente?.id, responsavel_id: p.responsavel?.id })}
                onDelete={() => remove(p.id)}
              />
            </div>
          </Card>
        ))}
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
