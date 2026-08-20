import React from "react";
import { Search } from "lucide-react";
import { COLORS } from "../lib/theme.js";

// Campo de busca reaproveitado nas abas com lista de cliente/processo — filtra em memória
// (sem round-trip ao banco), suficiente pro volume de um escritório pequeno.
export default function SearchInput({ value, onChange, placeholder = "Buscar..." }) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.slate }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-3 py-2 rounded-md text-sm w-full sm:w-64"
        style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, background: COLORS.paperRaised }}
      />
    </div>
  );
}
