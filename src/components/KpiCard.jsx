import React from "react";
import Card from "./Card.jsx";
import { COLORS } from "../lib/theme.js";

const TONS = {
  ink: { fg: COLORS.ink, bg: "rgba(22,35,59,0.07)" },
  success: { fg: COLORS.success, bg: "rgba(30,132,73,0.10)" },
  brass: { fg: COLORS.brass, bg: "rgba(165,121,59,0.12)" },
  wine: { fg: COLORS.wine, bg: "rgba(193,39,45,0.09)" },
  slate: { fg: COLORS.slate, bg: "rgba(91,100,114,0.08)" },
};

// Cartão de indicador padrão pras telas de números (Executivo, Financeiro, ERP) — mesmo
// texto/valor de sempre, mas com selo de ícone colorido + friso lateral pra puxar a cor do
// tom (sucesso/alerta/atraso) que antes só existia no número em si. `tone` decide a cor do
// friso/ícone; a cor do valor continua vindo de fora (quem chama já calcula isso certo).
export default function KpiCard({ icon: Icon, label, value, valueColor, caption, tone = "ink" }) {
  const t = TONS[tone] ?? TONS.ink;
  return (
    <Card style={{ borderLeft: `3px solid ${t.fg}` }} className="flex items-start gap-3">
      {Icon && (
        <div className="flex items-center justify-center rounded-full p-2 shrink-0" style={{ background: t.bg }}>
          <Icon size={16} color={t.fg} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide truncate" style={{ color: COLORS.slate }}>{label}</p>
        <p
          className="text-2xl mt-1 truncate"
          style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: valueColor ?? COLORS.ink }}
        >
          {value}
        </p>
        {caption && <p className="text-xs mt-1.5" style={{ color: COLORS.slate }}>{caption}</p>}
      </div>
    </Card>
  );
}
