import React, { useState } from "react";
import { Users, Plus } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import RowActions from "../RowActions.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import SearchInput from "../SearchInput.jsx";
import { COLORS } from "../../lib/theme.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";

const FIELDS = [
  { key: "nome", label: "Nome / Razão social" },
  { key: "tipo", label: "Tipo", type: "select", options: [{ value: "PF", label: "Pessoa Física" }, { value: "PJ", label: "Pessoa Jurídica" }] },
  { key: "origem", label: "Origem", optional: true },
  { key: "contrato_renovacao", label: "Renovação de contrato", type: "date", optional: true },
];

export default function ClientesTab({ currentRole }) {
  const { data: clientes, loading, insert, update, remove } = useSupabaseTable("clientes", { orderBy: "nome", ascending: true });
  const [editing, setEditing] = useState(null); // null = fechado, {} = novo, {...} = editando
  const [busca, setBusca] = useState("");
  const podeExcluir = currentRole === "admin" || currentRole === "socio"; // RLS (clientes_del) já barra no banco — isso só esconde o botão

  const filtrados = clientes.filter((c) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return c.nome.toLowerCase().includes(q) || (c.origem || "").toLowerCase().includes(q);
  });

  return (
    <div>
      <SectionTitle
        icon={Users}
        title="Clientes"
        subtitle="Base de clientes e contratos"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar cliente..." />
            <button
              onClick={() => setEditing({})}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold"
              style={{ background: COLORS.ink, color: "#fff" }}
            >
              <Plus size={14} /> Novo
            </button>
          </div>
        }
      />
      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: COLORS.ink }}>
              {["Cliente", "Tipo", "Origem", "Renovação de contrato", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>{busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</td></tr>
            )}
            {filtrados.map((c, i) => (
              <tr key={c.id} style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
                <td className="px-4 py-3" style={{ color: COLORS.ink }}>{c.nome}</td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{c.tipo}</td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{c.origem || "—"}</td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{c.contrato_renovacao || "—"}</td>
                <td className="px-4 py-3"><RowActions onEdit={() => setEditing(c)} onDelete={podeExcluir ? () => remove(c.id) : undefined} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
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
