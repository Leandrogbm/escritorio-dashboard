import React from "react";
import { Settings } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { MODULES } from "../config/permissions.js";

export default function Sidebar({ allowedModules, activeTab, setActiveTab, currentRole }) {
  return (
    <aside className="w-64 shrink-0 flex flex-col" style={{ background: COLORS.ink, minHeight: "100vh" }}>
      <div className="px-6 pt-7 pb-6 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ border: `2px solid ${COLORS.brass}`, boxShadow: `inset 0 0 0 2px ${COLORS.ink}, inset 0 0 0 3px ${COLORS.brass}` }}
        >
          <span style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.brass, fontWeight: 700, fontSize: 14 }}>A&T</span>
        </div>
        <div>
          <p style={{ fontFamily: "'Source Serif 4', serif", color: "#fff", fontWeight: 600, fontSize: 15, lineHeight: 1.15 }}>
            Almeida, Rocha &amp; Tavares
          </p>
          <p className="text-[11px] tracking-wide" style={{ color: "rgba(255,255,255,0.5)" }}>ADVOCACIA</p>
        </div>
      </div>

      <nav className="flex-1 px-3 pt-5 space-y-1">
        {MODULES.map((m) => {
          const allowed = allowedModules.includes(m.key);
          const Icon = m.icon;
          const active = activeTab === m.key;
          if (!allowed) return null;
          return (
            <button
              key={m.key}
              onClick={() => setActiveTab(m.key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors"
              style={{
                background: active ? "rgba(165,121,59,0.18)" : "transparent",
                color: active ? COLORS.brass : "rgba(255,255,255,0.75)",
                fontWeight: active ? 600 : 500,
              }}
            >
              <Icon size={17} />
              {m.label}
            </button>
          );
        })}

        {currentRole === "admin" && (
          <>
            <div className="pt-3 mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }} />
            <button
              onClick={() => setActiveTab("config")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm"
              style={{
                background: activeTab === "config" ? "rgba(165,121,59,0.18)" : "transparent",
                color: activeTab === "config" ? COLORS.brass : "rgba(255,255,255,0.75)",
                fontWeight: activeTab === "config" ? 600 : 500,
              }}
            >
              <Settings size={17} />
              Configurações
            </button>
          </>
        )}
      </nav>

      <div className="px-6 py-5 text-[11px]" style={{ color: "rgba(255,255,255,0.35)", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        Painel interno · uso restrito ao escritório
      </div>
    </aside>
  );
}
