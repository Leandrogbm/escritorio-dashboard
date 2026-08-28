import React from "react";
import { Inbox } from "lucide-react";
import { COLORS } from "../lib/theme.js";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      <div
        className="flex items-center justify-center rounded-full p-4 mb-4"
        style={{ background: "rgba(165,121,59,0.10)", border: `1px solid ${COLORS.line}` }}
      >
        <Inbox size={28} color={COLORS.brass} />
      </div>
      <p className="text-lg" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 600, color: COLORS.ink }}>
        Nenhuma aba liberada para este perfil
      </p>
      <p className="text-sm mt-1 max-w-xs" style={{ color: COLORS.slate }}>
        Peça ao administrador do escritório para liberar os módulos necessários em Configurações.
      </p>
    </div>
  );
}
