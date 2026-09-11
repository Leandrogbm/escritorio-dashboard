import React from "react";
import { COLORS } from "../lib/theme.js";

// `hoverable`: sobe e ganha sombra mais forte no hover (classe .card-hoverable, ver
// index.css) — usa em card de lista que representa um item "abrível" (mesmo que o clique de
// verdade seja num botão dentro dele), não em card que é só um bloco de layout/formulário.
// `folded`: dog-ear (canto de página dobrado) no topo direito — ligado por padrão, evoca
// capa de processo/lauda física. Desliga sozinho quando `className` já tem overflow-hidden
// (moldura de tabela, por ex.) pra não cortar a dobra pela metade.
export default function Card({ children, className = "", style = {}, hoverable = false, folded = true, onClick }) {
  const clipped = className.includes("overflow-hidden");
  return (
    <div
      className={`relative p-5 ${hoverable ? "card-hoverable" : "card-stacked"} ${className}`}
      style={{
        background: COLORS.paperRaised,
        border: `1px solid ${COLORS.line}`,
        // Cantos quase retos (capa de processo, não card de app) — só o inferior-esquerdo
        // arredonda um pouco, pra não virar caixa 100% quadrada.
        borderRadius: "2px 2px 2px 12px",
        ...style,
      }}
      onClick={onClick}
    >
      {folded && !clipped && <span className="card-dogear" aria-hidden="true" />}
      {children}
    </div>
  );
}
