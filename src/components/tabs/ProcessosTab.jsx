import React from "react";
import { Briefcase } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import Stamp from "../Stamp.jsx";
import { COLORS } from "../../lib/theme.js";
import { PROCESSOS, BRL } from "../../data/mockData.js";

const STATUS_TONE = { "Em andamento": "ok", "Aguardando decisão": "warn", "Suspenso": "neutral" };

export default function ProcessosTab() {
  return (
    <div>
      <SectionTitle icon={Briefcase} title="Processos" subtitle="Casos ativos do escritório" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROCESSOS.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.slate }}>{p.numero}</p>
                <p className="mt-1 text-lg" style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600 }}>{p.cliente}</p>
              </div>
              <Stamp tone={STATUS_TONE[p.status]}>{p.status}</Stamp>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: `1px solid ${COLORS.line}` }}>
              <span className="text-xs uppercase tracking-wide" style={{ color: COLORS.brass, fontWeight: 600 }}>{p.area}</span>
              <span className="text-sm" style={{ color: COLORS.slate }}>{p.responsavel}</span>
              <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>{p.valor ? BRL(p.valor) : "—"}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
