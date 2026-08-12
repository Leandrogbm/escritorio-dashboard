import React, { useState } from "react";
import { Scale, ChevronDown } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { ROLES } from "../config/permissions.js";

export default function TopBar({ currentRole, setCurrentRole }) {
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleLabel = ROLES.find((r) => r.key === currentRole)?.label;

  return (
    <header
      className="flex items-center justify-between px-8 py-4"
      style={{ background: COLORS.paperRaised, borderBottom: `1px solid ${COLORS.line}` }}
    >
      <div className="flex items-center gap-2" style={{ color: COLORS.slate }}>
        <Scale size={16} />
        <span className="text-sm">Dashboard interno</span>
      </div>

      <div className="relative">
        <button
          onClick={() => setRoleMenuOpen((v) => !v)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-md text-sm"
          style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, background: COLORS.paper }}
        >
          <span style={{ color: COLORS.slate }}>Visualizando como:</span>
          <span style={{ fontWeight: 600 }}>{roleLabel}</span>
          <ChevronDown size={14} />
        </button>
        {roleMenuOpen && (
          <div
            className="absolute right-0 mt-2 w-48 rounded-md overflow-hidden z-10"
            style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}`, boxShadow: "0 8px 24px rgba(22,35,59,0.12)" }}
          >
            {ROLES.map((r) => (
              <button
                key={r.key}
                onClick={() => { setCurrentRole(r.key); setRoleMenuOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm"
                style={{
                  color: r.key === currentRole ? COLORS.brass : COLORS.ink,
                  fontWeight: r.key === currentRole ? 600 : 400,
                  background: r.key === currentRole ? "rgba(165,121,59,0.08)" : "transparent",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
