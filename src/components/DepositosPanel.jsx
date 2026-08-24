import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import Card from "./Card.jsx";
import Stamp from "./Stamp.jsx";
import RowActions from "./RowActions.jsx";
import RecordFormModal from "./RecordFormModal.jsx";
import { COLORS } from "../lib/theme.js";
import { BRL } from "../data/mockData.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";

const TIPOS = ["Recursal", "Garantia de execução", "Penhora", "Caução", "Outro"];
const STATUS_TONE = { "Depositado": "warn", "Liberado": "ok", "Convertido em renda": "neutral" };

const FIELDS = [
  { key: "tipo", label: "Tipo de depósito", type: "select", options: TIPOS.map((t) => ({ value: t, label: t })) },
  { key: "valor", label: "Valor (R$)", type: "number" },
  { key: "data_deposito", label: "Data do depósito", type: "date" },
  { key: "status", label: "Situação", type: "select", options: Object.keys(STATUS_TONE).map((s) => ({ value: s, label: s })) },
  { key: "banco", label: "Banco/conta judicial", optional: true },
  { key: "numero_comprovante", label: "Número do comprovante", optional: true },
  { key: "observacoes", label: "Observações", optional: true },
];

// Depósito judicial fica retido numa conta do tribunal, não passa pela conta do escritório —
// diferente da importação de extrato (Financeiro), que bate honorário com o banco DO
// escritório. Aqui é só acompanhar o ciclo de vida (depositado → liberado/convertido).
export default function DepositosPanel({ processo, orgId, onClose }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: depositos, insert, update, remove } = useSupabaseTable("depositos_judiciais", {
    select: "*", eq: orgEq, orderBy: "data_deposito", ascending: false,
  });
  const doProcesso = depositos.filter((d) => d.processo_id === processo.id);
  const total = doProcesso.filter((d) => d.status !== "Liberado").reduce((s, d) => s + Number(d.valor), 0);
  const [editing, setEditing] = useState(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card>
          <div className="flex items-center justify-between mb-1">
            <div>
              <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 16, color: COLORS.ink }}>{processo.numero}</p>
              <p className="text-xs" style={{ color: COLORS.slate }}>Depósitos judiciais</p>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
          </div>
          <p className="text-2xl mb-4" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.brass }}>
            {BRL(total)} <span className="text-xs font-normal" style={{ color: COLORS.slate }}>ainda retidos</span>
          </p>

          <button
            onClick={() => setEditing({})}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold mb-4"
            style={{ background: COLORS.ink, color: "#fff" }}
          >
            <Plus size={14} /> Registrar depósito
          </button>

          <div className="flex flex-col gap-2">
            {doProcesso.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: COLORS.slate }}>Nenhum depósito registrado ainda.</p>
            )}
            {doProcesso.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md" style={{ border: `1px solid ${COLORS.line}` }}>
                <div className="min-w-0">
                  <p className="text-sm" style={{ color: COLORS.ink, fontWeight: 600 }}>{BRL(d.valor)} — {d.tipo}</p>
                  <p className="text-xs truncate" style={{ color: COLORS.slate }}>
                    {new Date(`${d.data_deposito}T00:00:00`).toLocaleDateString("pt-BR")}
                    {d.banco && ` · ${d.banco}`}
                    {d.numero_comprovante && ` · comprovante ${d.numero_comprovante}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Stamp tone={STATUS_TONE[d.status]}>{d.status}</Stamp>
                  <RowActions onEdit={() => setEditing(d)} onDelete={() => remove(d.id)} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <RecordFormModal
        open={editing !== null}
        title={editing?.id ? "Editar depósito" : "Registrar depósito"}
        fields={FIELDS}
        initialValues={editing}
        onClose={() => setEditing(null)}
        onSubmit={(values) => (editing?.id ? update(editing.id, values) : insert({ ...values, processo_id: processo.id }))}
      />
    </div>
  );
}
