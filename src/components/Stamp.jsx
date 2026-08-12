import React from "react";
import { COLORS } from "../lib/theme.js";

export default function Stamp({ children, tone = "neutral" }) {
  const color =
    tone === "urgent" ? COLORS.wine :
    tone === "warn" ? COLORS.brass :
    tone === "ok" ? COLORS.success :
    COLORS.slate;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
      style={{
        color,
        border: `1.5px solid ${color}`,
        letterSpacing: "0.12em",
        transform: "rotate(-1.5deg)",
        fontFamily: "'IBM Plex Mono', monospace",
        background: "rgba(255,255,255,0.4)",
      }}
    >
      {children}
    </span>
  );
}

export function urgencia(dias) {
  if (dias <= 3) return { label: "Urgente", tone: "urgent" };
  if (dias <= 10) return { label: "Atenção", tone: "warn" };
  return { label: "Em dia", tone: "ok" };
}
