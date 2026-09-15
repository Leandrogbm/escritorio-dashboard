import React, { useState } from "react";
import { Settings, Home, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { MODULES } from "../config/permissions.js";
import { useEscClose } from "../hooks/useEscClose.js";

// Item de navegação: ativo vira uma "aba de papel" creme puxada pra fora da capa escura
// (mesmo motivo "capa de processo" do resto do app) — não um wash translúcido genérico.
function NavItem({ icon: Icon, label, active, recolhida, onClick }) {
  return (
    <button
      onClick={onClick}
      title={recolhida ? label : undefined}
      className={`w-full flex items-center gap-3 py-2.5 rounded-2xl text-sm transition-all duration-150 ${
        !active ? "hover:bg-white/[0.07]" : "shadow-[0_2px_10px_rgba(0,0,0,0.18)]"
      } ${recolhida ? "md:justify-center md:px-0" : ""} px-3.5`}
      style={{
        background: active ? COLORS.paperRaised : "transparent",
        color: active ? COLORS.ink : "rgba(255,255,255,0.75)",
        fontWeight: active ? 600 : 500,
      }}
    >
      <Icon size={17} className="shrink-0" style={{ color: active ? COLORS.brass : undefined }} />
      <span className={recolhida ? "md:hidden" : ""}>{label}</span>
    </button>
  );
}

// Desktop (md+): cartão flutuante fixo, com o botão de recolher/expandir pra ícone-só.
// Mobile/tablet estreito: vira gaveta (drawer) sobre o conteúdo, aberta pelo hambúrguer
// da TopBar — sem "recolher" aqui, é aberta (tela toda) ou fechada (fora da tela).
export default function Sidebar({ allowedModules, activeTab, setActiveTab, currentRole, emSuporte, orgNome, mobileAberto, fecharMobile }) {
  const [recolhida, setRecolhida] = useState(() => localStorage.getItem("sidebarRecolhida") === "1");
  useEscClose(fecharMobile, mobileAberto);
  const alternar = () => {
    setRecolhida((v) => {
      localStorage.setItem("sidebarRecolhida", v ? "0" : "1");
      return !v;
    });
  };
  const escolher = (tab) => { setActiveTab(tab); fecharMobile(); };

  return (
    <>
      {mobileAberto && (
        <div className="fixed inset-0 z-30 md:hidden" style={{ background: "rgba(0,0,0,0.4)" }} onClick={fecharMobile} />
      )}
      <div
        className={`shrink-0 z-40 fixed md:relative inset-y-0 left-0 transition-transform md:transition-[width]
          w-64 ${recolhida ? "md:w-[72px]" : "md:w-64"}
          ${mobileAberto ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <aside
          className={`relative flex flex-col h-full md:h-[calc(100vh-24px)] md:my-3 md:ml-3 rounded-none md:rounded-[28px] overflow-visible`}
          style={{ background: COLORS.ink, boxShadow: "0 12px 32px -12px rgba(27,51,40,0.55)" }}
        >
          <button
            onClick={alternar}
            aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
            title={recolhida ? "Expandir menu" : "Recolher menu"}
            className="hidden md:flex absolute top-7 -right-3 z-10 w-7 h-7 rounded-full items-center justify-center hover:opacity-85 transition-opacity"
            style={{ background: COLORS.brass, color: COLORS.ink, boxShadow: "0 3px 8px rgba(0,0,0,0.3)" }}
          >
            {recolhida ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
          </button>
          <button
            onClick={fecharMobile}
            aria-label="Fechar menu"
            className="md:hidden absolute top-5 right-4 z-10 p-1 rounded"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            <X size={20} />
          </button>

          <div className={`pt-7 pb-6 flex items-center gap-3 ${recolhida ? "md:px-4 md:justify-center" : ""} px-6`} style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <img src="/brand/logo-icon.png" alt="Actum" className="w-9 h-9 shrink-0" />
            <div className={`min-w-0 ${recolhida ? "md:hidden" : ""}`}>
              <p className="truncate" style={{ fontFamily: "'Source Serif 4', serif", color: "#fff", fontWeight: 600, fontSize: 17, lineHeight: 1.15 }}>
                Actum
              </p>
              <p className="text-[11px] tracking-wide" style={{ color: "rgba(255,255,255,0.5)" }}>GESTÃO JURÍDICA E ERP</p>
            </div>
          </div>

          <nav className={`flex-1 pt-5 pb-4 space-y-1.5 overflow-y-auto ${recolhida ? "md:px-3" : ""} px-3.5`}>
            {MODULES.map((m) => {
              const allowed = allowedModules.includes(m.key);
              if (!allowed) return null;
              return (
                <NavItem
                  key={m.key}
                  icon={m.icon}
                  label={m.label}
                  active={activeTab === m.key}
                  recolhida={recolhida}
                  onClick={() => escolher(m.key)}
                />
              );
            })}

            {!emSuporte && (currentRole === "admin" || currentRole === "socio") && (
              <>
                <div className="pt-3 mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }} />
                <NavItem
                  icon={Home}
                  label="Minha Empresa"
                  active={activeTab === "empresa"}
                  recolhida={recolhida}
                  onClick={() => escolher("empresa")}
                />
              </>
            )}

            {(currentRole === "admin" || currentRole === "socio") && (
              <>
                <div className="pt-3 mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }} />
                <NavItem
                  icon={Settings}
                  label="Configurações"
                  active={activeTab === "config"}
                  recolhida={recolhida}
                  onClick={() => escolher("config")}
                />
              </>
            )}
          </nav>
        </aside>
      </div>
    </>
  );
}
