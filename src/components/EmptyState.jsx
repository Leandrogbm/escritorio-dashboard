import React from "react";
import { Inbox } from "lucide-react";
import { COLORS } from "../lib/theme.js";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      <Inbox size={34} color={COLORS.slate} className="mb-3" />
      <p className="text-lg" style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink }}>
        Nenhuma aba liberada para este perfil
      </p>
      <p className="text-sm mt-1 max-w-xs" style={{ color: COLORS.slate }}>
        Peça ao administrador do escritório para liberar os módulos necessários em Configurações.
      </p>
    </div>
  );
}
