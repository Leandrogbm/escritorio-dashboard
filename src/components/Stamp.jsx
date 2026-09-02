import React from "react";
import { COLORS } from "../lib/theme.js";

// Exportado — TableList.jsx (lombada colorida das linhas de lista) usa o mesmo mapa,
// pro spine da linha e o carimbo dentro dela nunca discordarem de cor.
export const TONE_COLOR = {
  urgent: COLORS.wine,
  warn: COLORS.brass,
  ok: COLORS.success,
  neutral: COLORS.slate,
};

export default function Stamp({ children, tone = "neutral" }) {
  const color = TONE_COLOR[tone] ?? COLORS.slate;
  // Carimbo "urgente" tem tinta ainda fresca — halo respira bem devagar atrás dele.
  // Reservado só a esse tom (usado em prazo estourando E em atrasado/vencido no
  // financeiro/ERP): é o mesmo alerta em qualquer lugar do sistema, não decoração local.
  const vivo = tone === "urgent";

  return (
    <span className="relative inline-flex align-middle">
      {vivo && (
        <span
          aria-hidden="true"
          className="carimbo-pulso absolute inset-0 rounded-full"
          style={{ background: color }}
        />
      )}
      <span
        className="relative inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
        style={{
          color,
          border: `1.5px solid ${color}`,
          // segundo anel — a "batida" dupla de um carimbo de borracha nunca cai perfeitamente
          // sobreposta na primeira.
          boxShadow: `inset 0 0 0 2.5px ${color}26`,
          letterSpacing: "0.12em",
          fontFamily: "'IBM Plex Mono', monospace",
          background: "transparent",
          textShadow: `0.5px 0.5px 0 ${color}4D`,
        }}
      >
        {children}
      </span>
    </span>
  );
}

// Dias entre hoje e uma data (negativo = já passou) — comparação por dia civil, não por
// timestamp exato (T00:00:00 nas duas pontas), senão "vence hoje às 23h" contava como
// "ontem" dependendo da hora que a pessoa está olhando. Usado por PrazosTab.jsx e
// HojeTab.jsx — uma fonte só, pra nunca discordarem sobre quantos dias faltam pro mesmo prazo.
export function diasAte(data) {
  return Math.ceil((new Date(`${data}T00:00:00`) - new Date(new Date().toDateString())) / 86400000);
}

export function urgencia(dias) {
  if (dias <= 3) return { label: "Urgente", tone: "urgent" };
  if (dias <= 10) return { label: "Atenção", tone: "warn" };
  return { label: "Em dia", tone: "ok" };
}
