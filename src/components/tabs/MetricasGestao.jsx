import React, { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Card from "../Card.jsx";
import KpiCard from "../KpiCard.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../lib/format.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";

const MES_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Mesma regra do resto do painel executivo: processo confidencial restrito a advogado(s)
// (confidencial e não aberto aos sócios) não entra nas contas — nem o financeiro ligado a ele.
const soDeSocio = (proc) => !(proc?.confidencial && !proc?.responsavel_socios);

// Métricas de gestão do Painel Executivo: inadimplência, entrada de processos por mês, prazos
// do mês e receita por cliente. Lê as tabelas direto (não as materialized views) porque
// precisa de cliente/data de cada linha — o volume de um escritório cabe tranquilo.
export default function MetricasGestao({ orgId }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: honorariosRaw } = useSupabaseTable("honorarios", {
    select: "id, valor, vencimento, status, cliente:clientes(id,nome), processo:processos(confidencial,responsavel_socios)",
    orderBy: "vencimento", eq: orgEq,
  });
  const { data: processosRaw } = useSupabaseTable("processos", { select: "id, created_at, confidencial, responsavel_socios", eq: orgEq });
  const { data: prazosRaw } = useSupabaseTable("prazos", {
    select: "id, data, feito, processo:processos(confidencial,responsavel_socios)", orderBy: "data", eq: orgEq,
  });

  const hoje = new Date().toLocaleDateString("sv");
  const mesAtual = hoje.slice(0, 7);

  const honorarios = useMemo(() => honorariosRaw.filter((h) => soDeSocio(h.processo)), [honorariosRaw]);

  // 1) Inadimplência: não pago e com vencimento já passado (independe de o status ter sido
  // trocado pra "Vencido" à mão — "Em aberto" com data passada também é atraso).
  const inadimplencia = useMemo(() => {
    const vencidos = honorarios.filter((h) => h.status !== "Pago" && h.vencimento < hoje);
    const porCliente = new Map();
    for (const h of vencidos) {
      const k = h.cliente?.id ?? "?";
      const atual = porCliente.get(k) ?? { nome: h.cliente?.nome ?? "Sem cliente", valor: 0 };
      atual.valor += Number(h.valor);
      porCliente.set(k, atual);
    }
    return {
      total: vencidos.reduce((s, h) => s + Number(h.valor), 0),
      clientes: porCliente.size,
      top: [...porCliente.values()].sort((a, b) => b.valor - a.valor).slice(0, 5),
    };
  }, [honorarios, hoje]);

  // 2) Entrada de processos nos últimos 6 meses (created_at).
  const entradaPorMes = useMemo(() => {
    const meses = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      meses.push({ chave: m.toLocaleDateString("sv").slice(0, 7), nome: `${MES_LABEL[m.getMonth()]}/${String(m.getFullYear()).slice(2)}`, novos: 0 });
    }
    const idx = new Map(meses.map((m, i) => [m.chave, i]));
    for (const p of processosRaw) {
      if (!soDeSocio(p)) continue;
      const i = idx.get(new Date(p.created_at).toLocaleDateString("sv").slice(0, 7));
      if (i !== undefined) meses[i].novos += 1;
    }
    return meses;
  }, [processosRaw]);

  // 3) Prazos com vencimento no mês atual.
  const prazosMes = useMemo(() => {
    const doMes = prazosRaw.filter((p) => soDeSocio(p.processo) && p.data?.slice(0, 7) === mesAtual);
    return {
      concluidos: doMes.filter((p) => p.feito).length,
      vencidos: doMes.filter((p) => !p.feito && p.data < hoje).length,
      aVencer: doMes.filter((p) => !p.feito && p.data >= hoje).length,
    };
  }, [prazosRaw, mesAtual, hoje]);

  // 4) Receita por cliente: honorários pagos com vencimento nos últimos 12 meses.
  const receitaPorCliente = useMemo(() => {
    const d = new Date();
    const inicio = new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()).toLocaleDateString("sv");
    const map = new Map();
    for (const h of honorarios) {
      if (h.status !== "Pago" || h.vencimento < inicio) continue;
      const k = h.cliente?.id ?? "?";
      const atual = map.get(k) ?? { nome: h.cliente?.nome ?? "Sem cliente", valor: 0 };
      atual.valor += Number(h.valor);
      map.set(k, atual);
    }
    return [...map.values()].sort((a, b) => b.valor - a.valor).slice(0, 5);
  }, [honorarios]);

  const tooltipStyle = { borderRadius: 8, border: `1px solid ${COLORS.line}`, fontFamily: "Inter" };

  return (
    <>
      <p className="text-xs font-semibold tracking-widest uppercase mt-2 mb-3" style={{ color: COLORS.brassText }}>Gestão</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={AlertTriangle} tone="wine" label="Inadimplência (vencido)" value={BRL(inadimplencia.total)} valueColor={COLORS.wine} />
        <KpiCard icon={Users} tone="slate" label="Clientes devendo" value={inadimplencia.clientes} />
        <KpiCard icon={CheckCircle2} tone="success" label="Prazos do mês concluídos" value={prazosMes.concluidos} valueColor={COLORS.success} />
        <KpiCard icon={Clock3} tone="wine" label="Prazos do mês vencidos em aberto" value={prazosMes.vencidos} valueColor={prazosMes.vencidos ? COLORS.wine : undefined} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <p className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>Maiores devedores</p>
          {inadimplencia.top.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.slate }}>Ninguém com pagamento vencido.</p>
          ) : (
            <ListaValores itens={inadimplencia.top} cor={COLORS.wine} />
          )}
        </Card>
        <Card>
          <p className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>Receita por cliente — últimos 12 meses</p>
          {receitaPorCliente.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.slate }}>Nenhum honorário pago nos últimos 12 meses.</p>
          ) : (
            <ListaValores itens={receitaPorCliente} cor={COLORS.success} />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <p className="text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>Processos novos por mês</p>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={entradaPorMes} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={COLORS.line} vertical={false} />
                <XAxis dataKey="nome" tick={{ fill: COLORS.slate, fontSize: 12 }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: COLORS.slate, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [v, "Processos novos"]} contentStyle={tooltipStyle} />
                <Bar dataKey="novos" radius={[4, 4, 0, 0]} fill={COLORS.ink} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <p className="text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>Prazos deste mês</p>
          {prazosMes.concluidos + prazosMes.vencidos + prazosMes.aVencer === 0 ? (
            <p className="text-sm" style={{ color: COLORS.slate }}>Nenhum prazo vencendo este mês.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {[
                { label: "Concluídos", v: prazosMes.concluidos, cor: COLORS.success },
                { label: "Vencidos sem concluir", v: prazosMes.vencidos, cor: COLORS.wine },
                { label: "A vencer", v: prazosMes.aVencer, cor: COLORS.brass },
              ].map((l) => {
                const total = prazosMes.concluidos + prazosMes.vencidos + prazosMes.aVencer;
                return (
                  <div key={l.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: COLORS.ink }}>{l.label}</span>
                      <span className="font-semibold" style={{ color: l.cor }}>{l.v}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: COLORS.line }}>
                      <div className="h-full rounded-full" style={{ width: `${(l.v / total) * 100}%`, background: l.cor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function ListaValores({ itens, cor }) {
  const max = itens[0]?.valor || 1;
  return (
    <div className="flex flex-col gap-2.5">
      {itens.map((i) => (
        <div key={i.nome}>
          <div className="flex justify-between gap-3 text-sm mb-1">
            <span className="truncate" style={{ color: COLORS.ink }}>{i.nome}</span>
            <span className="font-semibold shrink-0" style={{ color: cor }}>{BRL(i.valor)}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.line }}>
            <div className="h-full rounded-full" style={{ width: `${(i.valor / max) * 100}%`, background: cor }} />
          </div>
        </div>
      ))}
    </div>
  );
}
