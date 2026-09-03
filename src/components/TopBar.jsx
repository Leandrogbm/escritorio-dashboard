import React from "react";
import { Scale, LogOut, Menu, ShieldAlert } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { ROLES } from "../config/permissions.js";
import NotificacoesBell from "./NotificacoesBell.jsx";

// suporte = platform admin "entrou" numa empresa alheia como se fosse o admin de lá.
// Banner vermelho de propósito: é o modo com mais poder de todos, tem que ficar óbvio que
// não é a própria empresa da pessoa logada.
export default function TopBar({ profile, signOut, onAbrirMenu, suporte, onSairSuporte, orgId, onAbrirProcesso }) {
  const roleLabel = ROLES.find((r) => r.key === profile.role)?.label;

  return (
    <>
      {suporte && (
        <div className="flex items-center justify-between gap-2 px-4 sm:px-8 py-1.5 text-xs font-semibold" style={{ background: COLORS.wine, color: "#fff" }}>
          <span className="flex items-center gap-1.5"><ShieldAlert size={13} /> Modo suporte — mexendo em "{suporte}", não na sua empresa</span>
          <button onClick={onSairSuporte} className="underline shrink-0">Sair do modo suporte</button>
        </div>
      )}
      <header
        className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4 gap-2"
        style={{ background: COLORS.paperRaised, borderBottom: `1px solid ${COLORS.line}` }}
      >
        <div className="flex items-center gap-2 min-w-0" style={{ color: COLORS.slate }}>
          <button onClick={onAbrirMenu} aria-label="Abrir menu" className="p-1.5 -ml-1.5 rounded md:hidden shrink-0" style={{ color: COLORS.ink }}>
            <Menu size={20} />
          </button>
          <Scale size={16} className="shrink-0 hidden sm:block" />
          <span className="text-sm truncate">{suporte ?? profile.organizations?.nome ?? "Actum"}</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <NotificacoesBell orgId={orgId} onAbrirProcesso={onAbrirProcesso} />
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
    </>
  );
}
