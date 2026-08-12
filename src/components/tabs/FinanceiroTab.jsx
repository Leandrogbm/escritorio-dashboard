import React from "react";
import { DollarSign } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import Stamp from "../Stamp.jsx";
import { COLORS } from "../../lib/theme.js";
import { HONORARIOS, BRL } from "../../data/mockData.js";

export default function FinanceiroTab() {
  const faturamento = 284500;
  const meta = 320000;
  const pct = Math.round((faturamento / meta) * 100);
  const inadimplencia = HONORARIOS.filter((h) => h.status === "Vencido").reduce((s, h) => s + h.valor, 0);

  return (
    <div>
      <SectionTitle icon={DollarSign} title="Financeiro" subtitle="Faturamento, metas e honorários a receber" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Faturamento do mês</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.ink }}>{BRL(faturamento)}</p>
          <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: COLORS.line }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS.success }} />
          </div>
          <p className="text-xs mt-1.5" style={{ color: COLORS.slate }}>{pct}% da meta de {BRL(meta)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Inadimplência</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.wine }}>{BRL(inadimplencia)}</p>
          <p className="text-xs mt-1.5" style={{ color: COLORS.slate }}>2 honorários vencidos</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>A receber (total)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.ink }}>
            {BRL(HONORARIOS.reduce((s, h) => s + h.valor, 0))}
          </p>
          <p className="text-xs mt-1.5" style={{ color: COLORS.slate }}>{HONORARIOS.length} honorários em aberto</p>
        </Card>
      </div>
      <Card className="overflow-hidden !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: COLORS.ink }}>
              {["Cliente", "Valor", "Vencimento", "Situação"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HONORARIOS.map((h, i) => (
              <tr key={h.cliente} style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
                <td className="px-4 py-3" style={{ color: COLORS.ink }}>{h.cliente}</td>
                <td className="px-4 py-3 font-semibold" style={{ color: COLORS.ink }}>{BRL(h.valor)}</td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{h.vencimento}</td>
                <td className="px-4 py-3"><Stamp tone={h.status === "Vencido" ? "urgent" : "warn"}>{h.status}</Stamp></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
