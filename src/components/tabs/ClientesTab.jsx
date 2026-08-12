import React, { useState } from "react";
import { Users, Plus } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import RowActions from "../RowActions.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import { COLORS } from "../../lib/theme.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";

const FIELDS = [
  { key: "nome", label: "Nome / Razão social" },
  { key: "tipo", label: "Tipo", type: "select", options: [{ value: "PF", label: "Pessoa Física" }, { value: "PJ", label: "Pessoa Jurídica" }] },
  { key: "origem", label: "Origem", optional: true },
  { key: "contrato_renovacao", label: "Renovação de contrato", type: "date", optional: true },
];

export default function ClientesTab() {
  const { data: clientes, loading, insert, update, remove } = useSupabaseTable("clientes", { orderBy: "nome", ascending: true });
  const [editing, setEditing] = useState(null); // null = fechado, {} = novo, {...} = editando

  return (
    <div>
      <SectionTitle
        icon={Users}
        title="Clientes"
        subtitle="Base de clientes e contratos"
        action={
          <button
            onClick={() => setEditing({})}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold"
            style={{ background: COLORS.ink, color: "#fff" }}
          >
            <Plus size={14} /> Novo
          </button>
        }
      />
      <Card className="overflow-hidden !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: COLORS.ink }}>
              {["Cliente", "Tipo", "Origem", "Renovação de contrato", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && clientes.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>Nenhum cliente cadastrado ainda.</td></tr>
            )}
            {clientes.map((c, i) => (
              <tr key={c.id} style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
                <td className="px-4 py-3" style={{ color: COLORS.ink }}>{c.nome}</td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{c.tipo}</td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{c.origem || "—"}</td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{c.contrato_renovacao || "—"}</td>
                <td className="px-4 py-3"><RowActions onEdit={() => setEditing(c)} onDelete={() => remove(c.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <RecordFormModal
        open={editing !== null}
        title={editing?.id ? "Editar cliente" : "Novo cliente"}
        fields={FIELDS}
        initialValues={editing}
        onClose={() => setEditing(null)}
        onSubmit={(values) => (editing?.id ? update(editing.id, values) : insert(values))}
      />
    </div>
  );
}
