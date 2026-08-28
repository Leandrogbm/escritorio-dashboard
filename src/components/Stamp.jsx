import React from "react";
import { COLORS } from "../lib/theme.js";

const TONE_COLOR = {
  urgent: COLORS.wine,
  warn: COLORS.brass,
  ok: COLORS.success,
  neutral: COLORS.slate,
};

// Rotação leve e determinística a partir do texto — um carimbo de verdade nunca bate duas
// vezes exatamente igual, mas o MESMO carimbo (mesmo label) não pode "tremer" a cada
// re-render, senão vira ruído em vez de textura.
function tiltFor(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return -3 + (h % 601) / 100; // -3.00deg .. +3.00deg
}

// Grão de tinta — ruído fractal via SVG, reaproveitado como textura em cima do carimbo.
// Data URI (não <filter id> na página) de propósito: com várias listas de prazos/status na
// mesma tela, um id de filtro só existiria uma vez no DOM e todo o resto ficaria sem grão.
const GRAIN_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.45 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>";
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(GRAIN_SVG)}")`;

export default function Stamp({ children, tone = "neutral" }) {
  const color = TONE_COLOR[tone] ?? COLORS.slate;
  const tilt = tiltFor(String(children));
  // Carimbo "urgente" tem tinta ainda fresca — halo respira bem devagar atrás dele.
  // Reservado só a esse tom (usado em prazo estourando E em atrasado/vencido no
  // financeiro/ERP): é o mesmo alerta em qualquer lugar do sistema, não decoração local.
  const vivo = tone === "urgent";

  return (
    <span className="relative inline-flex align-middle" style={{ transform: `rotate(${tilt}deg)` }}>
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
          backgroundColor: "rgba(255,255,255,0.45)",
          backgroundImage: GRAIN,
          backgroundBlendMode: "multiply",
          textShadow: `0.5px 0.5px 0 ${color}4D`,
        }}
      >
        {children}
      </span>
    </span>
  );
}

export function urgencia(dias) {
  if (dias <= 3) return { label: "Urgente", tone: "urgent" };
  if (dias <= 10) return { label: "Atenção", tone: "warn" };
  return { label: "Em dia", tone: "ok" };
}
