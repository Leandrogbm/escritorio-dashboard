import React, { useState } from "react";
import { Settings, Home, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { MODULES } from "../config/permissions.js";
import { useEscClose } from "../hooks/useEscClose.js";

// Desktop (md+): coluna fixa, com o botão de recolher/expandir pra ícone-só.
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
      <aside
        className={`shrink-0 flex flex-col transition-transform md:transition-all z-40
          fixed md:relative inset-y-0 left-0 w-64 ${recolhida ? "md:w-[72px]" : "md:w-64"}
          ${mobileAberto ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
        style={{ background: COLORS.ink, minHeight: "100vh" }}
      >
        <button
          onClick={alternar}
          aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
          title={recolhida ? "Expandir menu" : "Recolher menu"}
          className="hidden md:flex absolute top-6 -right-3 z-10 w-6 h-6 rounded-full items-center justify-center hover:opacity-80"
          style={{ background: COLORS.brass, color: COLORS.ink }}
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

        <nav className={`flex-1 pt-5 space-y-1 overflow-y-auto ${recolhida ? "md:px-2" : ""} px-3`}>
          {MODULES.map((m) => {
            const allowed = allowedModules.includes(m.key);
            const Icon = m.icon;
            const active = activeTab === m.key;
            if (!allowed) return null;
            return (
              <button
                key={m.key}
                onClick={() => escolher(m.key)}
                title={recolhida ? m.label : undefined}
                className={`w-full flex items-center gap-3 py-2.5 rounded-md text-sm transition-colors ${!active ? "hover:bg-white/[0.06]" : ""} ${recolhida ? "md:justify-center md:px-0" : ""} px-3`}
                style={{
                  background: active ? "rgba(165,121,59,0.18)" : undefined,
                  color: active ? COLORS.brass : "rgba(255,255,255,0.75)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                <Icon size={17} className="shrink-0" />
                <span className={recolhida ? "md:hidden" : ""}>{m.label}</span>
              </button>
            );
          })}

          {!emSuporte && (currentRole === "admin" || currentRole === "socio") && (
            <>
              <div className="pt-3 mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }} />
              <button
                onClick={() => escolher("empresa")}
                title={recolhida ? "Minha Empresa" : undefined}
                className={`w-full flex items-center gap-3 py-2.5 rounded-md text-sm transition-colors ${activeTab !== "empresa" ? "hover:bg-white/[0.06]" : ""} ${recolhida ? "md:justify-center md:px-0" : ""} px-3`}
                style={{
                  background: activeTab === "empresa" ? "rgba(165,121,59,0.18)" : undefined,
                  color: activeTab === "empresa" ? COLORS.brass : "rgba(255,255,255,0.75)",
                  fontWeight: activeTab === "empresa" ? 600 : 500,
                }}
              >
                <Home size={17} className="shrink-0" />
                <span className={recolhida ? "md:hidden" : ""}>Minha Empresa</span>
              </button>
            </>
          )}

          {(currentRole === "admin" || currentRole === "socio") && (
            <>
              <div className="pt-3 mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }} />
              <button
                onClick={() => escolher("config")}
                title={recolhida ? "Configurações" : undefined}
                className={`w-full flex items-center gap-3 py-2.5 rounded-md text-sm ${recolhida ? "md:justify-center md:px-0" : ""} px-3`}
                style={{
                  background: activeTab === "config" ? "rgba(165,121,59,0.18)" : "transparent",
                  color: activeTab === "config" ? COLORS.brass : "rgba(255,255,255,0.75)",
                  fontWeight: activeTab === "config" ? 600 : 500,
                }}
              >
                <Settings size={17} className="shrink-0" />
                <span className={recolhida ? "md:hidden" : ""}>Configurações</span>
              </button>
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
