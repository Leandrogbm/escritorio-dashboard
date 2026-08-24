import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import Stamp from "./Stamp.jsx";
import { COLORS } from "../lib/theme.js";
import { useEscClose } from "../hooks/useEscClose.js";

// Selo de status clicável — abre uma lista curta pra trocar na hora, sem precisar abrir o
// formulário de editar só pra isso. `tone`: mesmo mapa {status: "ok"|"warn"|"neutral"|"urgent"}
// que o Stamp já usa.
export default function StatusPicker({ value, options, tone, onChange }) {
  const [aberto, setAberto] = useState(false);
  useEscClose(() => setAberto(false), aberto);

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setAberto((v) => !v)} className="flex items-center gap-1 hover:opacity-80">
        <Stamp tone={tone[value]}>{value}</Stamp>
        <ChevronDown size={12} color={COLORS.slate} />
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 mt-1.5 z-50 rounded-lg overflow-hidden py-1" style={{ minWidth: 160, background: "#fff", border: `1px solid ${COLORS.line}`, boxShadow: "0 8px 24px rgba(22,35,59,0.14)" }}>
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setAberto(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:opacity-70"
                style={{ color: COLORS.ink, fontWeight: opt === value ? 600 : 400, background: opt === value ? "rgba(165,121,59,0.08)" : "transparent" }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
