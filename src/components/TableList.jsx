import React from "react";
import { COLORS } from "../lib/theme.js";
import { TONE_COLOR } from "./Stamp.jsx";

// Cabeçalho de lista "documento", não de planilha — o bloco escuro cheio (COLORS.ink de
// borda a borda) era o maior sinal de Excel que essas tabelas tinham. Aqui é só uma legenda
// discreta com um traço fino embaixo; a cor vem de brassText (mesmo tom já usado pra texto
// miúdo em cima de fundo claro, ver theme.js) em vez de um bloco pintado.
export function TableHead({ columns }) {
  return (
    <thead>
      <tr style={{ borderBottom: `2px solid ${COLORS.line}` }}>
        {columns.map((h) => (
          <th key={h} className="text-left px-4 py-2.5 font-semibold whitespace-nowrap" style={{ color: COLORS.brassText, fontSize: 10.5, letterSpacing: "0.08em" }}>
            {h && h.toUpperCase()}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// Linha de lista — sem zebra (listras alternadas são o segundo maior sinal de planilha);
// só um traço fino embaixo e mais respiro vertical (via py-3.5 nas células de quem usa isto).
// `tone` é o mesmo tom de {ok|warn|urgent|neutral} que Stamp/StatusPicker já usam nessa
// linha — quando informado, vira uma lombada colorida à esquerda (mesmo semáforo do carimbo,
// só que visível antes de ler qualquer texto). Sem tone = linha sem status pra comunicar,
// fica neutra de propósito (nada de cor decorativa sem significado).
export function Tr({ children, onClick, tone, className = "" }) {
  const accent = tone ? TONE_COLOR[tone] ?? COLORS.line : "transparent";
  return (
    <tr
      onClick={onClick}
      className={`transition-colors ${onClick ? "cursor-pointer hover:!bg-[rgba(165,121,59,0.06)]" : ""} ${className}`}
      style={{
        borderBottom: `1px solid ${COLORS.line}`,
        borderLeft: `3px solid ${accent}`,
        background: COLORS.paperRaised,
      }}
    >
      {children}
    </tr>
  );
}
