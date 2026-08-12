import React, { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../data/mockData.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";

export default function ExecutivoTab() {
  const { data: processos, loading } = useSupabaseTable("processos", { select: "area, valor, status" });
  const { data: clientes } = useSupabaseTable("clientes", { select: "id" });

  const receitaPorArea = useMemo(() => {
    const porArea = {};
    for (const p of processos) porArea[p.area] = (porArea[p.area] ?? 0) + Number(p.valor ?? 0);
    return Object.entries(porArea).map(([area, valor]) => ({ area, valor }));
  }, [processos]);

  const totalReceita = receitaPorArea.reduce((s, r) => s + r.valor, 0);
  const ativos = processos.filter((p) => p.status !== "Encerrado").length;

  return (
    <div>
      <SectionTitle icon={TrendingUp} title="Visão Executiva" subtitle="Panorama consolidado do escritório" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Valor total em causas</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.ink }}>{BRL(totalReceita)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Processos ativos</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.ink }}>{ativos}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Total de clientes</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.ink }}>{clientes.length}</p>
        </Card>
      </div>
      <Card>
        <p className="text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>Valor em causas por área do direito</p>
        {!loading && receitaPorArea.length === 0 ? (
          <p className="text-sm" style={{ color: COLORS.slate }}>Sem processos cadastrados ainda.</p>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={receitaPorArea} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={COLORS.line} vertical={false} />
                <XAxis dataKey="area" tick={{ fill: COLORS.slate, fontSize: 12 }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v) => BRL(v)} contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.line}`, fontFamily: "Inter" }} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} fill={COLORS.wine} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
