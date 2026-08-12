import React, { useMemo, useState } from "react";
import { DollarSign, Plus } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import Stamp from "../Stamp.jsx";
import RowActions from "../RowActions.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../data/mockData.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";

const STATUS_OPTIONS = [
  { value: "Em aberto", label: "Em aberto" },
  { value: "Vencido", label: "Vencido" },
  { value: "Pago", label: "Pago" },
];

export default function FinanceiroTab() {
  const { data: honorarios, loading, insert, update, remove } = useSupabaseTable("honorarios", {
    select: "*, cliente:clientes(id,nome)",
  });
  const { data: clientes } = useSupabaseTable("clientes", { select: "id,nome", orderBy: "nome", ascending: true });
  const [editing, setEditing] = useState(null);

  const fields = useMemo(() => [
    { key: "cliente_id", label: "Cliente", type: "select", options: clientes.map((c) => ({ value: c.id, label: c.nome })) },
    { key: "valor", label: "Valor (R$)", type: "number" },
    { key: "vencimento", label: "Vencimento", type: "date" },
    { key: "status", label: "Situação", type: "select", options: STATUS_OPTIONS },
  ], [clientes]);

  const abertos = honorarios.filter((h) => h.status === "Em aberto").reduce((s, h) => s + h.valor, 0);
  const vencidos = honorarios.filter((h) => h.status === "Vencido");
  const inadimplencia = vencidos.reduce((s, h) => s + h.valor, 0);
  const recebido = honorarios.filter((h) => h.status === "Pago").reduce((s, h) => s + h.valor, 0);

  return (
    <div>
      <SectionTitle
        icon={DollarSign}
        title="Financeiro"
        subtitle="Honorários a receber, vencidos e recebidos"
        action={
          <button onClick={() => setEditing({})} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
            <Plus size={14} /> Novo
          </button>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Em aberto</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.ink }}>{BRL(abertos)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Inadimplência</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.wine }}>{BRL(inadimplencia)}</p>
          <p className="text-xs mt-1.5" style={{ color: COLORS.slate }}>{vencidos.length} honorário(s) vencido(s)</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Recebido</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.success }}>{BRL(recebido)}</p>
        </Card>
      </div>
      <Card className="overflow-hidden !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: COLORS.ink }}>
              {["Cliente", "Valor", "Vencimento", "Situação", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && honorarios.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>Nenhum honorário cadastrado ainda.</td></tr>
            )}
            {honorarios.map((h, i) => (
              <tr key={h.id} style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
                <td className="px-4 py-3" style={{ color: COLORS.ink }}>{h.cliente?.nome ?? "—"}</td>
                <td className="px-4 py-3 font-semibold" style={{ color: COLORS.ink }}>{BRL(h.valor)}</td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{new Date(`${h.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3"><Stamp tone={h.status === "Vencido" ? "urgent" : h.status === "Pago" ? "ok" : "warn"}>{h.status}</Stamp></td>
                <td className="px-4 py-3">
                  <RowActions
                    onEdit={() => setEditing({ ...h, cliente_id: h.cliente?.id })}
                    onDelete={() => remove(h.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <RecordFormModal
        open={editing !== null}
        title={editing?.id ? "Editar honorário" : "Novo honorário"}
        fields={fields}
        initialValues={editing}
        onClose={() => setEditing(null)}
        onSubmit={(values) => (editing?.id ? update(editing.id, values) : insert(values))}
      />
    </div>
  );
}
