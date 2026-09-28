import React, { useMemo } from "react";
import { Download, Printer } from "lucide-react";
import { BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Card from "../Card.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../lib/format.js";
import { GRUPOS_DESPESA, GRUPO_OUTRAS, grupoDaDespesa } from "../../config/planoContas.js";

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (m) => `${MES_CURTO[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const somaMes = (m, n) => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1).toLocaleDateString("sv").slice(0, 7);
const dataBR = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
const areaDe = (h) => h.processo?.area || "Sem área (sem processo)";

// Aba "Caixa do mês" do ERP, parte de baixo: fluxo projetado, DRE por plano de contas e
// exportação pro contador. Tudo regime de caixa (vencimento + situação "Pago"), mesmo
// critério dos cartões de cima.
export default function CaixaErp({ mes, honorarios, despesas, nomeEscritorio }) {
  const recebidosMes = honorarios.filter((h) => h.status === "Pago" && h.vencimento?.slice(0, 7) === mes);
  const pagasMes = despesas.filter((d) => d.status === "Pago" && d.vencimento?.slice(0, 7) === mes);

  // Fluxo projetado: mês escolhido + 5 seguintes, com tudo que vence em cada mês (pago ou
  // não). Atrasado de meses anteriores entra no primeiro mês — é dinheiro que ainda pode
  // entrar/sair. Acumulado parte de zero (o Actum não sabe o saldo do banco).
  const projecao = useMemo(() => {
    const meses = Array.from({ length: 6 }, (_, i) => somaMes(mes, i));
    const linhas = meses.map((m) => ({ mes: m, nome: rotuloMes(m), entrada: 0, saida: 0 }));
    const idx = new Map(meses.map((m, i) => [m, i]));
    const alocar = (venc, pago) => {
      const k = venc?.slice(0, 7);
      if (idx.has(k)) return idx.get(k);
      return !pago && k < mes ? 0 : -1; // atrasado não pago vai pro primeiro mês
    };
    for (const h of honorarios) { const i = alocar(h.vencimento, h.status === "Pago"); if (i >= 0) linhas[i].entrada += Number(h.valor); }
    for (const d of despesas) { const i = alocar(d.vencimento, d.status === "Pago"); if (i >= 0) linhas[i].saida += Number(d.valor); }
    let acumulado = 0;
    return linhas.map((l) => { acumulado += l.entrada - l.saida; return { ...l, resultado: l.entrada - l.saida, acumulado }; });
  }, [honorarios, despesas, mes]);

  // DRE do mês por plano de contas (despesas) e centro de custo = área do direito (receitas).
  const dre = useMemo(() => {
    const receitaPorArea = new Map();
    for (const h of recebidosMes) receitaPorArea.set(areaDe(h), (receitaPorArea.get(areaDe(h)) ?? 0) + Number(h.valor));
    const porGrupo = new Map([...GRUPOS_DESPESA, GRUPO_OUTRAS].map((g) => [g.key, { ...g, valor: 0 }]));
    for (const d of pagasMes) porGrupo.get(grupoDaDespesa(d.categoria).key).valor += Number(d.valor);
    const receitaBruta = recebidosMes.reduce((s, h) => s + Number(h.valor), 0);
    const impostos = porGrupo.get("impostos").valor;
    const operacionais = [...porGrupo.values()].filter((g) => g.key !== "impostos");
    const totalOperacional = operacionais.reduce((s, g) => s + g.valor, 0);
    return {
      areas: [...receitaPorArea.entries()].sort((a, b) => b[1] - a[1]),
      receitaBruta, impostos, receitaLiquida: receitaBruta - impostos,
      operacionais, resultado: receitaBruta - impostos - totalOperacional,
    };
  }, [recebidosMes, pagasMes]);

  // Planilha pro contador: CSV com ";" e BOM — é o que o Excel em português abre certo.
  const exportarPlanilha = () => {
    const num = (v) => Number(v).toFixed(2).replace(".", ",");
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [
      ["Tipo", "Data", "Cliente / Fornecedor", "Descrição", "Categoria / Área", "Valor (R$)"],
      ...recebidosMes.map((h) => ["Receita", dataBR(h.vencimento), h.cliente?.nome ?? "", h.descricao_servico ?? "Honorários", areaDe(h), num(h.valor)]),
      ...pagasMes.map((d) => ["Despesa", dataBR(d.vencimento), d.fornecedor ?? "", d.descricao, d.categoria ?? "", num(-d.valor)]),
      [],
      ["", "", "", "", "Total receitas", num(dre.receitaBruta)],
      ["", "", "", "", "Total despesas", num(-pagasMes.reduce((s, d) => s + Number(d.valor), 0))],
      ["", "", "", "", "Resultado", num(dre.resultado)],
    ];
    const csv = "﻿" + linhas.map((l) => l.map(esc).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `financeiro-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // PDF: abre uma página de relatório e chama a impressão do navegador ("Salvar como PDF").
  const exportarPdf = () => {
    const w = window.open("", "_blank");
    if (!w) return alert("O navegador bloqueou a janela do relatório — libere pop-ups para este site.");
    const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const linha = (cols) => `<tr>${cols.map((c, i) => `<td${i === cols.length - 1 ? ' class="n"' : ""}>${esc(c)}</td>`).join("")}</tr>`;
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Financeiro ${esc(mes)}</title>
<style>body{font:12px Arial,sans-serif;margin:32px;color:#1B3328}h1{font-size:18px;margin:0}h2{font-size:14px;margin:24px 0 6px}
table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left}.n{text-align:right;white-space:nowrap}
.t td{font-weight:bold;border-top:2px solid #1B3328}</style></head><body>
<h1>${esc(nomeEscritorio ?? "Escritório")} — Relatório financeiro</h1><p>Competência: ${esc(mes.slice(5, 7))}/${esc(mes.slice(0, 4))} · regime de caixa</p>
<h2>DRE</h2><table>
${linha(["Receita bruta (honorários recebidos)", BRL(dre.receitaBruta)])}
${linha(["(−) Impostos e taxas", BRL(-dre.impostos)])}
${linha(["= Receita líquida", BRL(dre.receitaLiquida)])}
${dre.operacionais.filter((g) => g.valor).map((g) => linha([`(−) ${g.label}`, BRL(-g.valor)])).join("")}
<tr class="t"><td>= Resultado do mês</td><td class="n">${esc(BRL(dre.resultado))}</td></tr></table>
<h2>Receitas</h2><table><tr><th>Data</th><th>Cliente</th><th>Área</th><th class="n">Valor</th></tr>
${recebidosMes.map((h) => linha([dataBR(h.vencimento), h.cliente?.nome, areaDe(h), BRL(h.valor)])).join("") || "<tr><td colspan=4>Nenhuma</td></tr>"}</table>
<h2>Despesas</h2><table><tr><th>Data</th><th>Fornecedor</th><th>Descrição</th><th>Categoria</th><th class="n">Valor</th></tr>
${pagasMes.map((d) => linha([dataBR(d.vencimento), d.fornecedor, d.descricao, d.categoria, BRL(d.valor)])).join("") || "<tr><td colspan=5>Nenhuma</td></tr>"}</table>
<script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  const tooltipStyle = { borderRadius: 8, border: `1px solid ${COLORS.line}`, fontFamily: "Inter" };
  const linhaDre = (label, valor, forte = false) => (
    <div
      className={`flex justify-between gap-3 text-sm ${forte ? "py-2 px-2 -mx-2 rounded" : "py-1.5"}`}
      style={{
        borderTop: forte ? `1px solid ${COLORS.ink}` : undefined,
        background: forte ? "rgba(27,51,40,0.05)" : undefined,
        fontWeight: forte ? 700 : 400,
      }}
    >
      <span style={{ color: COLORS.ink }}>{label}</span>
      <span
        className="tabular-nums"
        style={{ color: valor < 0 ? COLORS.wine : COLORS.ink, fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {BRL(valor)}
      </span>
    </div>
  );
  const eyebrow = (label) => (
    <p className="text-[11px] font-semibold tracking-widest uppercase mt-4 mb-1 first:mt-0" style={{ color: COLORS.brassText }}>{label}</p>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 mt-6 mb-3">
        <span className="text-xs mr-auto" style={{ color: COLORS.slate }}>Para o contador — receitas e despesas pagas no mês:</span>
        <button onClick={exportarPlanilha} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
          <Download size={14} /> Planilha (Excel)
        </button>
        <button onClick={exportarPdf} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
          <Printer size={14} /> PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <p className="text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>DRE do mês</p>
          <p className="text-xs mb-3" style={{ color: COLORS.slate }}>Regime de caixa — só o que foi pago dentro do mês.</p>

          {eyebrow("Receitas por área")}
          {linhaDre("Receita bruta (honorários recebidos)", dre.receitaBruta)}
          {dre.areas.map(([area, v]) => (
            <div key={area} className="flex justify-between gap-3 pl-4 text-xs py-1" style={{ color: COLORS.slate, borderTop: `1px dashed ${COLORS.line}` }}>
              <span className="truncate">{area}</span>
              <span className="tabular-nums shrink-0" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{BRL(v)}</span>
            </div>
          ))}
          {linhaDre("(−) Impostos e taxas", -dre.impostos)}
          {linhaDre("= Receita líquida", dre.receitaLiquida, true)}

          {eyebrow("Despesas por categoria")}
          {dre.operacionais.map((g) => <React.Fragment key={g.key}>{linhaDre(`(−) ${g.label}`, -g.valor)}</React.Fragment>)}
          {linhaDre("= Resultado do mês", dre.resultado, true)}
        </Card>

        <Card>
          <p className="text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>Fluxo de caixa projetado — próximos 6 meses</p>
          <p className="text-xs mb-3" style={{ color: COLORS.slate }}>Tudo que vence em cada mês (pago ou não); atrasados entram no primeiro mês.</p>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <ComposedChart data={projecao} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={COLORS.line} vertical={false} />
                <XAxis dataKey="nome" tick={{ fill: COLORS.slate, fontSize: 12 }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => BRL(v)} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => ({ entrada: "A entrar", saida: "A sair", acumulado: "Saldo acumulado" }[v])} />
                <Bar dataKey="entrada" fill={COLORS.success} radius={[4, 4, 0, 0]} />
                <Bar dataKey="saida" fill={COLORS.wine} radius={[4, 4, 0, 0]} />
                <Line dataKey="acumulado" stroke={COLORS.brass} strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs" style={{ minWidth: 360 }}>
              <thead>
                <tr>
                  <th className="text-left font-semibold pb-1.5" style={{ color: COLORS.slate }}>Mês</th>
                  <th className="text-right font-semibold pb-1.5" style={{ color: COLORS.slate }}>Entrou</th>
                  <th className="text-right font-semibold pb-1.5" style={{ color: COLORS.slate }}>Saiu</th>
                  <th className="text-right font-semibold pb-1.5" style={{ color: COLORS.slate }}>Saldo acum.</th>
                </tr>
              </thead>
              <tbody>
                {projecao.map((l, i) => (
                  <tr key={l.mes} style={{ borderTop: `1px solid ${COLORS.line}`, background: i === 0 ? "rgba(165,121,59,0.07)" : undefined }}>
                    <td className="py-1.5 font-semibold" style={{ color: COLORS.ink }}>{l.nome}</td>
                    <td className="py-1.5 text-right tabular-nums" style={{ color: COLORS.success, fontFamily: "'IBM Plex Mono', monospace" }}>{BRL(l.entrada)}</td>
                    <td className="py-1.5 text-right tabular-nums" style={{ color: COLORS.wine, fontFamily: "'IBM Plex Mono', monospace" }}>−{BRL(l.saida)}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums" style={{ color: l.acumulado < 0 ? COLORS.wine : COLORS.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{BRL(l.acumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
