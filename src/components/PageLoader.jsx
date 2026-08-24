import React from "react";
import { Scale } from "lucide-react";
import { COLORS } from "../lib/theme.js";

// Balança da justiça balançando — mostrado por um instante ao trocar de aba (ver App.jsx),
// no lugar do spinner genérico. Some sozinho quando o conteúdo da aba nova está pronto.
export default function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <Scale size={40} color={COLORS.brass} className="balanca-animada" />
      <p className="text-xs uppercase tracking-widest" style={{ color: COLORS.slate }}>Carregando</p>
    </div>
  );
}
