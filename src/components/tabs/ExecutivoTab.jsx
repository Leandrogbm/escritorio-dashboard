import React, { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../data/mockData.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";

const MES_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const STATUS_CORES = { "Em andamento": COLORS.success, "Aguardando decisão": COLORS.brass, "Suspenso": COLORS.slate, "Encerrado": COLORS.line };

export default function ExecutivoTab({ orgId } = {}) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: processos, loading } = useSupabaseTable("processos", { select: "area, valor, status, responsavel:profiles(nome)", eq: orgEq });
  const { data: clientes } = useSupabaseTable("clientes", { select: "id", eq: orgEq });
  const { data: honorarios, loading: loadingFinanceiro } = useSupabaseTable("honorarios", { select: "valor, status, vencimento", eq: orgEq });
  const [periodo, setPeriodo] = useState("mes"); // "mes" | "ano" — agrupamento do gráfico financeiro

  const receitaPorArea = useMemo(() => {
    const porArea = {};
    for (const p of processos) porArea[p.area] = (porArea[p.area] ?? 0) + Number(p.valor ?? 0);
    return Object.entries(porArea).map(([area, valor]) => ({ area, valor }));
  }, [processos]);

  const totalReceita = receitaPorArea.reduce((s, r) => s + r.valor, 0);
  const ativos = processos.filter((p) => p.status !== "Encerrado").length;

  const processosPorStatus = useMemo(() => {
    const porStatus = {};
    for (const p of processos) porStatus[p.status] = (porStatus[p.status] ?? 0) + 1;
    return Object.entries(porStatus).map(([status, total]) => ({ status, total }));
  }, [processos]);

  // Carga de trabalho por responsável — só processos ativos, senão advogado que encerrou
  // tudo aparece "sobrecarregado" com casos que já acabaram.
  const processosPorResponsavel = useMemo(() => {
    const porResp = {};
    for (const p of processos) {
      if (p.status === "Encerrado") continue;
      const nome = p.responsavel?.nome ?? "Sem responsável";
      porResp[nome] = (porResp[nome] ?? 0) + 1;
    }
    return Object.entries(porResp).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  }, [processos]);

  // Mesmo critério do FinanceiroTab: "Pago" é recebido, qualquer outra situação (em aberto
  // ou vencido) ainda está a receber.
  const totalHonorarios = honorarios.reduce((s, h) => s + Number(h.valor ?? 0), 0);
  const recebido = honorarios.filter((h) => h.status === "Pago").reduce((s, h) => s + Number(h.valor ?? 0), 0);
  const aReceber = totalHonorarios - recebido;

  // Agrupa por mês (vencimento.slice(0,7)) ou por ano (slice(0,4)); dentro de cada período
  // separa recebido x a receber pro gráfico empilhado.
  const financeiroPorPeriodo = useMemo(() => {
    const chave = (v) => (periodo === "ano" ? v?.slice(0, 4) : v?.slice(0, 7));
    const rotulo = (k) => {
      if (periodo === "ano") return k;
      const [ano, mes] = k.split("-");
      return `${MES_LABEL[Number(mes) - 1]}/${ano.slice(2)}`;
    };
    const map = new Map();
    for (const h of honorarios) {
      const k = chave(h.vencimento);
      if (!k) continue;
      if (!map.has(k)) map.set(k, { chave: k, recebido: 0, aReceber: 0 });
      const bucket = map.get(k);
      if (h.status === "Pago") bucket.recebido += Number(h.valor ?? 0);
      else bucket.aReceber += Number(h.valor ?? 0);
    }
    return [...map.values()].sort((a, b) => a.chave.localeCompare(b.chave)).map((b) => ({ ...b, nome: rotulo(b.chave) }));
  }, [honorarios, periodo]);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Total (honorários)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.ink }}>{BRL(totalHonorarios)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Recebido</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.success }}>{BRL(recebido)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>A receber</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.brass }}>{BRL(aReceber)}</p>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Financeiro — recebido e a receber</p>
          <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${COLORS.line}` }}>
            {[{ key: "mes", label: "Por mês" }, { key: "ano", label: "Por ano" }].map((op) => (
              <button
                key={op.key}
                onClick={() => setPeriodo(op.key)}
                className="px-3 py-1.5 text-xs font-semibold"
                style={{ background: periodo === op.key ? COLORS.ink : "transparent", color: periodo === op.key ? "#fff" : COLORS.slate }}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>
        {!loadingFinanceiro && totalHonorarios === 0 ? (
          <p className="text-sm" style={{ color: COLORS.slate }}>Sem cobranças cadastradas ainda.</p>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={financeiroPorPeriodo} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={COLORS.line} vertical={false} />
                <XAxis dataKey="nome" tick={{ fill: COLORS.slate, fontSize: 12 }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v) => BRL(v)} contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.line}`, fontFamily: "Inter" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === "recebido" ? "Recebido" : "A receber")} />
                <Bar dataKey="recebido" stackId="v" radius={[0, 0, 0, 0]} fill={COLORS.success} />
                <Bar dataKey="aReceber" stackId="v" radius={[4, 4, 0, 0]} fill={COLORS.brass} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <p className="text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>Processos por situação</p>
          {!loading && processosPorStatus.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.slate }}>Sem processos cadastrados ainda.</p>
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={processosPorStatus} dataKey="total" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={(d) => `${d.status} (${d.total})`}>
                    {processosPorStatus.map((s) => <Cell key={s.status} fill={STATUS_CORES[s.status] ?? COLORS.slate} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.line}`, fontFamily: "Inter" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card>
          <p className="text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>Carga de trabalho — processos ativos por responsável</p>
          {!loading && processosPorResponsavel.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.slate }}>Sem processos ativos.</p>
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={processosPorResponsavel} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke={COLORS.line} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: COLORS.slate, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="nome" width={110} tick={{ fill: COLORS.slate, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.line}`, fontFamily: "Inter" }} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} fill={COLORS.brass} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
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
