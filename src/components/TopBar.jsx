import React from "react";
import { Scale, LogOut, Menu } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { ROLES } from "../config/permissions.js";
import NotificacoesBell from "./NotificacoesBell.jsx";

export default function TopBar({ profile, signOut, onAbrirMenu }) {
  const roleLabel = ROLES.find((r) => r.key === profile.role)?.label;

  return (
    <header
      className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4 gap-2"
      style={{ background: COLORS.paperRaised, borderBottom: `1px solid ${COLORS.line}` }}
    >
      <div className="flex items-center gap-2 min-w-0" style={{ color: COLORS.slate }}>
        <button onClick={onAbrirMenu} aria-label="Abrir menu" className="p-1.5 -ml-1.5 rounded md:hidden shrink-0" style={{ color: COLORS.ink }}>
          <Menu size={20} />
        </button>
        <Scale size={16} className="shrink-0 hidden sm:block" />
        <span className="text-sm truncate">{profile.organizations?.nome ?? "Escritório Dashboard"}</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <NotificacoesBell />
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{profile.nome}</p>
          <p className="text-xs" style={{ color: COLORS.slate }}>{roleLabel}</p>
        </div>
        <button
          onClick={signOut}
          aria-label="Sair"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-md text-sm"
          style={{ border: `1px solid ${COLORS.line}`, color: COLORS.slate }}
        >
          <LogOut size={14} /> <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}
