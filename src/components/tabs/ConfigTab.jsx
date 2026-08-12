import React from "react";
import { Settings, ShieldCheck } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import { COLORS } from "../../lib/theme.js";
import { ROLES, MODULES } from "../../config/permissions.js";

export default function ConfigTab({ permissions, togglePermission }) {
  return (
    <div>
      <SectionTitle icon={Settings} title="Configurações" subtitle="Defina quais abas cada perfil enxerga no dashboard" />
      <Card className="overflow-hidden !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: COLORS.ink }}>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>PERFIL</th>
              {MODULES.map((m) => (
                <th key={m.key} className="text-center px-3 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>{m.label.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.filter((r) => r.key !== "admin").map((r, i) => (
              <tr key={r.key} style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
                <td className="px-4 py-3 font-medium" style={{ color: COLORS.ink }}>{r.label}</td>
                {MODULES.map((m) => {
                  const checked = permissions[r.key].includes(m.key);
                  return (
                    <td key={m.key} className="text-center px-3 py-3">
                      <button
                        onClick={() => togglePermission(r.key, m.key)}
                        className="w-5 h-5 rounded inline-flex items-center justify-center"
                        style={{
                          border: `1.5px solid ${checked ? COLORS.success : COLORS.slate}`,
                          background: checked ? COLORS.success : "transparent",
                        }}
                        aria-label={`${checked ? "Remover" : "Conceder"} acesso de ${r.label} a ${m.label}`}
                      >
                        {checked && <ShieldCheck size={13} color="#fff" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs mt-3" style={{ color: COLORS.slate }}>
        O perfil Administrador(a) sempre enxerga todos os módulos e não pode ser restringido por aqui.
      </p>
    </div>
  );
}
