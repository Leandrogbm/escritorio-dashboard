import React, { useState } from "react";
import { Settings, ChevronsLeft, ChevronsRight } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { MODULES } from "../config/permissions.js";

// Iniciais do nome da empresa pro badge do topo (ex.: "Gimenes & Pires" → "GP")
function iniciais(nome) {
  return (nome || "ED")
    .split(/\s+/)
    .filter((w) => w.length > 1) // ignora "&", "de", etc.
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "ED";
}

export default function Sidebar({ allowedModules, activeTab, setActiveTab, currentRole, orgNome }) {
  const [recolhida, setRecolhida] = useState(() => localStorage.getItem("sidebarRecolhida") === "1");
  const alternar = () => {
    setRecolhida((v) => {
      localStorage.setItem("sidebarRecolhida", v ? "0" : "1");
      return !v;
    });
  };

  return (
    <aside className="shrink-0 flex flex-col transition-all" style={{ width: recolhida ? 72 : 256, background: COLORS.ink, minHeight: "100vh" }}>
      <div className={`pt-7 pb-6 flex items-center gap-3 ${recolhida ? "px-4 justify-center" : "px-6"}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ border: `2px solid ${COLORS.brass}`, boxShadow: `inset 0 0 0 2px ${COLORS.ink}, inset 0 0 0 3px ${COLORS.brass}` }}
        >
          <span style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.brass, fontWeight: 700, fontSize: 14 }}>{iniciais(orgNome)}</span>
        </div>
        {!recolhida && (
          <div className="min-w-0">
            <p className="truncate" style={{ fontFamily: "'Source Serif 4', serif", color: "#fff", fontWeight: 600, fontSize: 15, lineHeight: 1.15 }}>
              {orgNome || "Escritório Dashboard"}
            </p>
            <p className="text-[11px] tracking-wide" style={{ color: "rgba(255,255,255,0.5)" }}>ADVOCACIA</p>
          </div>
        )}
      </div>

      <nav className={`flex-1 pt-5 space-y-1 ${recolhida ? "px-2" : "px-3"}`}>
        {MODULES.map((m) => {
          const allowed = allowedModules.includes(m.key);
          const Icon = m.icon;
          const active = activeTab === m.key;
          if (!allowed) return null;
          return (
            <button
              key={m.key}
              onClick={() => setActiveTab(m.key)}
              title={recolhida ? m.label : undefined}
              className={`w-full flex items-center gap-3 py-2.5 rounded-md text-sm transition-colors ${recolhida ? "justify-center px-0" : "px-3"}`}
              style={{
                background: active ? "rgba(165,121,59,0.18)" : "transparent",
                color: active ? COLORS.brass : "rgba(255,255,255,0.75)",
                fontWeight: active ? 600 : 500,
              }}
            >
              <Icon size={17} />
              {!recolhida && m.label}
            </button>
          );
        })}

        {currentRole === "admin" && (
          <>
            <div className="pt-3 mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }} />
            <button
              onClick={() => setActiveTab("config")}
              title={recolhida ? "Configurações" : undefined}
              className={`w-full flex items-center gap-3 py-2.5 rounded-md text-sm ${recolhida ? "justify-center px-0" : "px-3"}`}
              style={{
                background: activeTab === "config" ? "rgba(165,121,59,0.18)" : "transparent",
                color: activeTab === "config" ? COLORS.brass : "rgba(255,255,255,0.75)",
                fontWeight: activeTab === "config" ? 600 : 500,
              }}
            >
              <Settings size={17} />
              {!recolhida && "Configurações"}
            </button>
          </>
        )}
      </nav>

      <button
        onClick={alternar}
        aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
        className={`flex items-center gap-2 py-4 text-xs hover:opacity-80 ${recolhida ? "justify-center px-0" : "px-6"}`}
        style={{ color: "rgba(255,255,255,0.5)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
      >
        {recolhida ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> Recolher</>}
      </button>
    </aside>
  );
}
