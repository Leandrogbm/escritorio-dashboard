import React from "react";
import { Archive } from "lucide-react";
import { COLORS } from "../lib/theme.js";

// Alterna a lista entre ativos e arquivados (Clientes e Processos).
export default function BotaoArquivo({ ativo, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold"
      style={{
        border: `1px solid ${ativo ? COLORS.brass : COLORS.line}`,
        background: ativo ? "rgba(165,121,59,0.10)" : "transparent",
        color: COLORS.ink,
      }}
    >
      <Archive size={14} /> {ativo ? "Voltar aos ativos" : "Arquivo"}
    </button>
  );
}
