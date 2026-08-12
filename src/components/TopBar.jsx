import React from "react";
import { Scale, LogOut } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { ROLES } from "../config/permissions.js";

export default function TopBar({ profile, signOut }) {
  const roleLabel = ROLES.find((r) => r.key === profile.role)?.label;

  return (
    <header
      className="flex items-center justify-between px-8 py-4"
      style={{ background: COLORS.paperRaised, borderBottom: `1px solid ${COLORS.line}` }}
    >
      <div className="flex items-center gap-2" style={{ color: COLORS.slate }}>
        <Scale size={16} />
        <span className="text-sm">Gimenes &amp; Pires</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{profile.nome}</p>
          <p className="text-xs" style={{ color: COLORS.slate }}>{roleLabel}</p>
        </div>
        <button
          onClick={signOut}
          aria-label="Sair"
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm"
          style={{ border: `1px solid ${COLORS.line}`, color: COLORS.slate }}
        >
          <LogOut size={14} /> Sair
        </button>
      </div>
    </header>
  );
}
