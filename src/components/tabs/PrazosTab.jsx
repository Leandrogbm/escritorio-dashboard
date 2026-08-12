import React from "react";
import { Clock } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import Stamp, { urgencia } from "../Stamp.jsx";
import { COLORS } from "../../lib/theme.js";
import { PRAZOS } from "../../data/mockData.js";

export default function PrazosTab() {
  const sorted = [...PRAZOS].sort((a, b) => a.dias - b.dias);
  return (
    <div>
      <SectionTitle icon={Clock} title="Prazos" subtitle="Próximos vencimentos, do mais urgente ao mais distante" />
      <Card className="overflow-hidden !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: COLORS.ink }}>
              {["Processo", "Cliente", "Tipo", "Data", "Responsável", "Situação"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11, letterSpacing: "0.06em" }}>
                  {h.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const u = urgencia(p.dias);
              return (
                <tr key={p.id} style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
                  <td className="px-4 py-3" style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.inkSoft, fontSize: 12.5 }}>{p.processo}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.ink }}>{p.cliente}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.slate }}>{p.tipo}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.slate }}>{p.data}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.slate }}>{p.responsavel}</td>
                  <td className="px-4 py-3"><Stamp tone={u.tone}>{u.label} · {p.dias}d</Stamp></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
