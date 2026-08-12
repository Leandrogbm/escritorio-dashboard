import React from "react";
import { Building2 } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import Stamp from "../Stamp.jsx";
import { COLORS } from "../../lib/theme.js";
import { EQUIPE } from "../../data/mockData.js";

export default function EquipeTab() {
  return (
    <div>
      <SectionTitle icon={Building2} title="Equipe" subtitle="Carga de trabalho e horas faturáveis" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {EQUIPE.map((e) => {
          const pct = Math.round((e.horas / e.meta) * 100);
          return (
            <Card key={e.nome}>
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 600, color: COLORS.ink }}>{e.nome}</p>
                  <p className="text-xs" style={{ color: COLORS.brass, letterSpacing: "0.04em" }}>{e.cargo.toUpperCase()}</p>
                </div>
                <Stamp tone="neutral">{e.ativos} ativos</Stamp>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1" style={{ color: COLORS.slate }}>
                  <span>Horas faturáveis</span>
                  <span>{e.horas}h / {e.meta}h</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: COLORS.line }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 90 ? COLORS.success : COLORS.brass }} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
