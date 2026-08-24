import React from "react";
import { COLORS } from "../lib/theme.js";

// `hoverable`: sobe e ganha sombra mais forte no hover (classe .card-hoverable, ver
// index.css) — usa em card de lista que representa um item "abrível" (mesmo que o clique de
// verdade seja num botão dentro dele), não em card que é só um bloco de layout/formulário.
export default function Card({ children, className = "", style = {}, hoverable = false }) {
  return (
    <div
      className={`rounded-lg p-5 ${hoverable ? "card-hoverable" : ""} ${className}`}
      style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}`, ...(hoverable ? {} : { boxShadow: "0 1px 2px rgba(22,35,59,0.04)" }), ...style }}
    >
      {children}
    </div>
  );
}
