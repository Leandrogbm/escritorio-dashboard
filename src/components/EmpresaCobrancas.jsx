import React from "react";
import { X, Wallet } from "lucide-react";
import Card from "./Card.jsx";
import StatusPicker from "./StatusPicker.jsx";
import { COLORS } from "../lib/theme.js";
import { BRL } from "../data/mockData.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { useEscClose } from "../hooks/useEscClose.js";

const STATUS_TONE = { pago: "ok", pendente: "warn", atrasado: "urgent" };
const STATUS_OPTIONS = ["pago", "pendente", "atrasado"];

// Histórico mês a mês do que a empresa paga PRA plataforma (Actum) — diferente do financeiro
// interno dela. Cobranças são lançadas automaticamente (6 meses de uma vez) toda vez que um
// plano é atribuído/trocado em "Configurar" — ver trigger lancar_cobrancas_plano no schema.
export default function EmpresaCobrancas({ orgId, orgNome, onClose }) {
  useEscClose(onClose);
  const { data: cobrancas, update } = useSupabaseTable("platform_cobrancas", {
    select: "id, mes_referencia, valor, status", eq: ["org_id", orgId], orderBy: "mes_referencia", ascending: true,
  });

  const totalPago = cobrancas.filter((c) => c.status === "pago").reduce((s, c) => s + Number(c.valor), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,35,59,0.35)" }}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg p-6" style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}` }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Wallet size={18} color={COLORS.brass} />
            <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 18, color: COLORS.ink }}>{orgNome}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
        </div>
        <p className="text-xs mb-4" style={{ color: COLORS.slate }}>Cobrança mês a mês (plataforma) · recebido: <strong style={{ color: COLORS.success }}>{BRL(totalPago)}</strong></p>

        <Card className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead>
              <tr><th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>MÊS</th>
                <th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>VALOR</th>
                <th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>SITUAÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {cobrancas.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center" style={{ color: COLORS.slate }}>Nenhuma cobrança lançada ainda — atribua um plano em "Configurar".</td></tr>
              )}
              {cobrancas.map((c) => (
                <tr key={c.id} style={{ borderTop: `1px solid ${COLORS.line}` }}>
                  <td className="px-4 py-2.5" style={{ color: COLORS.ink, fontWeight: 600 }}>
                    {new Date(`${c.mes_referencia}T00:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>{BRL(c.valor)}</td>
                  <td className="px-4 py-2.5">
                    <StatusPicker value={c.status} options={STATUS_OPTIONS} tone={STATUS_TONE} onChange={(status) => update(c.id, { status })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
