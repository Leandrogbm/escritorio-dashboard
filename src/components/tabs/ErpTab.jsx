import React, { useMemo, useRef, useState } from "react";
import { Calculator, Plus, Copy, Check, Upload, Filter, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import StatusPicker from "../StatusPicker.jsx";
import RowActions from "../RowActions.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import SearchInput from "../SearchInput.jsx";
import ImportarExtratoModal from "./ImportarExtratoModal.jsx";
import FornecedorBell from "../FornecedorBell.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../data/mockData.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
import { useEscClose } from "../../hooks/useEscClose.js";
import { CATEGORIAS_DESPESA_COMUNS } from "../../config/categoriasDespesa.js";

// Um mês certinho depois — mesma lógica do FinanceiroTab (honorarios), pra "repetir
// mensalmente" gerar uma conta recorrente (CPFL, SEMAE, aluguel...) de uma vez só.
function addMonths(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

const STATUS_OPTIONS = [
  { value: "Em aberto", label: "Em aberto" },
  { value: "Vencido", label: "Vencido" },
  { value: "Pago", label: "Pago" },
];
const MES_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const hojeStr = new Date().toISOString().slice(0, 10);
const mesAtual = hojeStr.slice(0, 7);
const estaAtrasado = (d) => d.status === "Vencido" || (d.status === "Em aberto" && d.vencimento < hojeStr);
const chaveFornecedor = (d) => (d.fornecedor || "").trim() || "Sem fornecedor";

// Contas a pagar do escritório (aluguel, salário, fornecedor...) — junto com honorarios
// (contas a receber, já existente em Financeiro) dá fluxo de caixa e DRE simplificado.
// Não é ERP de verdade (sem folha de pagamento, ativo fixo, orçamento) — só o essencial
// pra saber quanto entra, quanto sai, e se sobra.
export default function ErpTab({ orgId }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: despesas, loading, insert, update, remove } = useSupabaseTable("despesas", { eq: orgEq, orderBy: "vencimento", ascending: true });
  const { data: honorarios } = useSupabaseTable("honorarios", { select: "id, cliente:clientes(id,nome), valor, status, vencimento", eq: orgEq });
  const { data: notificacoesTodas, refresh: refreshNotificacoes } = useSupabaseTable("notificacoes", { select: "id, tipo, despesa_id, titulo, texto", eq: orgEq });
  const [editing, setEditing] = useState(null);
  const [selecionado, setSelecionado] = useState(null); // fornecedor (chave) aberto no painel de detalhe
  const [busca, setBusca] = useState("");
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [filtro, setFiltro] = useState({ mes: mesAtual, fornecedor: "", dataInicio: "", dataFim: "" });
  const [arquivoExtrato, setArquivoExtrato] = useState(null);
  const fileInputRef = useRef(null);
  const [copiado, setCopiado] = useState(null); // id da despesa cujo código acabou de ser copiado
  useEscClose(() => setSelecionado(null), !!selecionado);

  const escolherArquivoExtrato = () => fileInputRef.current?.click();
  const arquivoExtratoEscolhido = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setArquivoExtrato(file);
  };

  const copiarCodigo = async (d) => {
    const codigo = d.pix_copia_cola || d.linha_digitavel;
    if (!codigo) return;
    await navigator.clipboard.writeText(codigo);
    setCopiado(d.id);
    setTimeout(() => setCopiado((c) => (c === d.id ? null : c)), 2000);
  };

  // Notificação não guarda fornecedor direto — só despesa_id — casa pelo mapa despesa→chave
  // do fornecedor (a mesma normalização usada pra agrupar a tabela).
  const notificacoesPorFornecedor = useMemo(() => {
    const despesaParaFornecedor = new Map(despesas.map((d) => [d.id, chaveFornecedor(d)]));
    const map = new Map();
    for (const n of notificacoesTodas) {
      if (n.tipo !== "despesa_paga_possivel") continue;
      const chave = despesaParaFornecedor.get(n.despesa_id);
      if (!chave) continue;
      if (!map.has(chave)) map.set(chave, []);
      map.get(chave).push(n);
    }
    return map;
  }, [notificacoesTodas, despesas]);

  // Dentro do mês selecionado no filtro, ou dentro do período (data início/fim) se
  // preenchido — período manual tem prioridade sobre o seletor de mês.
  const dentroDoPeriodo = (d) => {
    if (filtro.dataInicio || filtro.dataFim) {
      if (filtro.dataInicio && d.vencimento < filtro.dataInicio) return false;
      if (filtro.dataFim && d.vencimento > filtro.dataFim) return false;
      return true;
    }
    return d.vencimento?.slice(0, 7) === filtro.mes;
  };

  // Resumo por fornecedor — igual ao "por cliente" do Financeiro: Total/Pago/A pagar só do
  // período selecionado (senão uma conta recorrente gerada com meses futuros infla o
  // "a pagar"); Atrasado é sempre geral. Em aberto dentro do prazo = a pagar; fora = atrasado
  // (nunca conta nos dois ao mesmo tempo).
  const porFornecedor = useMemo(() => {
    const map = new Map();
    for (const d of despesas) {
      const chave = chaveFornecedor(d);
      if (!map.has(chave)) map.set(chave, { nome: chave, total: 0, pago: 0, aPagar: 0, atrasado: 0, itens: [] });
      const g = map.get(chave);
      g.itens.push(d);
      const atrasado = estaAtrasado(d);
      if (atrasado) g.atrasado += Number(d.valor);
      if (dentroDoPeriodo(d)) {
        g.total += Number(d.valor);
        if (d.status === "Pago") g.pago += Number(d.valor);
        else if (!atrasado) g.aPagar += Number(d.valor);
      }
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [despesas, filtro]);

  const fornecedoresUnicos = useMemo(() => [...new Set(despesas.map(chaveFornecedor))].sort(), [despesas]);

  const fornecedorAberto = porFornecedor.find((f) => f.nome === selecionado) ?? null;
  const porFornecedorFiltrado = porFornecedor.filter((f) => {
    if (filtro.fornecedor && f.nome !== filtro.fornecedor) return false;
    return f.nome.toLowerCase().includes(busca.trim().toLowerCase());
  });
  const filtrosAtivos = filtro.fornecedor || filtro.dataInicio || filtro.dataFim || filtro.mes !== mesAtual;

  // Cards do topo somam os fornecedores filtrados — período/fornecedor do filtro refletem
  // direto nesses totais, não só na tabela.
  const totalPago = porFornecedorFiltrado.reduce((s, f) => s + f.pago, 0);
  const totalAberto = porFornecedorFiltrado.reduce((s, f) => s + f.aPagar, 0);
  const totalAtrasado = porFornecedorFiltrado.reduce((s, f) => s + f.atrasado, 0);
  const atrasadas = despesas.filter(estaAtrasado);

  // Fluxo de caixa: entrada (honorário pago) x saída (despesa paga), por mês de vencimento —
  // sempre todos os meses, independente do filtro acima (visão de tendência, não do período).
  const fluxoPorMes = useMemo(() => {
    const map = new Map();
    const add = (vencimento, campo, valor) => {
      const k = vencimento?.slice(0, 7);
      if (!k) return;
      if (!map.has(k)) map.set(k, { chave: k, entrada: 0, saida: 0 });
      map.get(k)[campo] += Number(valor ?? 0);
    };
    for (const h of honorarios) if (h.status === "Pago") add(h.vencimento, "entrada", h.valor);
    for (const d of despesas) if (d.status === "Pago") add(d.vencimento, "saida", d.valor);
    return [...map.values()]
      .sort((a, b) => a.chave.localeCompare(b.chave))
      .map((b) => {
        const [ano, mes] = b.chave.split("-");
        return { ...b, nome: `${MES_LABEL[Number(mes) - 1]}/${ano.slice(2)}`, saldo: b.entrada - b.saida };
      });
  }, [honorarios, despesas]);

  // DRE simplificado do período selecionado: só o que já foi recebido/pago de verdade
  // (regime caixa, não competência).
  const receitaMes = honorarios.filter((h) => h.status === "Pago" && dentroDoPeriodo(h)).reduce((s, h) => s + Number(h.valor), 0);
  const despesaMes = totalPago;
  const resultadoMes = receitaMes - despesaMes;

  const fields = useMemo(() => {
    const base = [
      { key: "descricao", label: "Descrição" },
      { key: "fornecedor", label: "Fornecedor (quem cobra — ex: CPFL, SEMAE)", optional: true },
      { key: "categoria", label: "Categoria", type: "datalist", options: CATEGORIAS_DESPESA_COMUNS.map((c) => ({ value: c })), optional: true },
      { key: "valor", label: "Valor (R$)", type: "number" },
      { key: "vencimento", label: editing?.id ? "Vencimento" : "Vencimento (da 1ª conta, se repetir)", type: "date" },
    ];
    if (!editing?.id) {
      base.push({ key: "parcelas", label: "Conta que se repete todo mês? Gerar quantos meses de uma vez? (1 = avulsa)", type: "number", optional: true });
    }
    base.push(
      { key: "status", label: "Situação", type: "select", options: STATUS_OPTIONS },
      { key: "linha_digitavel", label: "Código de barras do boleto (linha digitável)", optional: true },
      { key: "pix_copia_cola", label: "Pix copia-e-cola", optional: true },
    );
    return base;
  }, [editing]);

  const salvar = ({ parcelas, ...values }) => {
    if (editing?.id) return update(editing.id, values);
    const n = Math.min(60, Math.max(1, parseInt(parcelas, 10) || 1)); // teto de 5 anos
    const linhas = n === 1 ? values : Array.from({ length: n }, (_, i) => ({ ...values, vencimento: addMonths(values.vencimento, i) }));
    return insert(linhas).then(() => setSelecionado((s) => s ?? values.fornecedor?.trim() ?? "Sem fornecedor"));
  };

  return (
    <div>
      <SectionTitle
        icon={Calculator}
        title="ERP"
        subtitle="Contas a pagar, fluxo de caixa e resultado do escritório"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar fornecedor..." />
            <button onClick={() => setFiltroAberto((v) => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${filtrosAtivos ? COLORS.brass : COLORS.line}`, color: filtrosAtivos ? COLORS.brass : COLORS.ink }}>
              <Filter size={14} /> Filtros
            </button>
            <button onClick={escolherArquivoExtrato} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
              <Upload size={14} /> Importar extrato
            </button>
            <input ref={fileInputRef} type="file" accept=".ofx,.csv,.txt,.pdf,image/*" className="hidden" onChange={arquivoExtratoEscolhido} />
            <button onClick={() => setEditing({})} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
              <Plus size={14} /> Nova despesa
            </button>
          </div>
        }
      />

      {filtroAberto && (
        <Card className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Filtros</p>
            {filtrosAtivos && (
              <button onClick={() => setFiltro({ mes: mesAtual, fornecedor: "", dataInicio: "", dataFim: "" })} className="text-xs underline" style={{ color: COLORS.slate }}>
                Limpar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
              Mês
              <input type="month" value={filtro.mes} onChange={(e) => setFiltro((f) => ({ ...f, mes: e.target.value }))} disabled={!!(filtro.dataInicio || filtro.dataFim)} className="px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, opacity: filtro.dataInicio || filtro.dataFim ? 0.5 : 1 }} />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
              Fornecedor
              <select value={filtro.fornecedor} onChange={(e) => setFiltro((f) => ({ ...f, fornecedor: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
                <option value="">Todos</option>
                {fornecedoresUnicos.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
              Vencimento de
              <input type="date" value={filtro.dataInicio} onChange={(e) => setFiltro((f) => ({ ...f, dataInicio: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }} />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
              Vencimento até
              <input type="date" value={filtro.dataFim} onChange={(e) => setFiltro((f) => ({ ...f, dataFim: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }} />
            </label>
          </div>
          {(filtro.dataInicio || filtro.dataFim) && (
            <p className="text-xs mt-2" style={{ color: COLORS.slate }}>Período manual preenchido — o seletor de mês fica desativado até limpar.</p>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Despesas pagas (período)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: totalPago ? COLORS.success : COLORS.slate }}>{BRL(totalPago)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>A pagar (período)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: totalAberto ? COLORS.brass : COLORS.slate }}>{BRL(totalAberto)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Em atraso (total)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: totalAtrasado ? COLORS.wine : COLORS.slate }}>{BRL(totalAtrasado)}</p>
          <p className="text-xs mt-1.5" style={{ color: COLORS.slate }}>{atrasadas.length} despesa(s) atrasada(s) no total</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Receita recebida (período)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: receitaMes ? COLORS.ink : COLORS.slate }}>{BRL(receitaMes)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Despesa paga (período)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: despesaMes ? COLORS.ink : COLORS.slate }}>{BRL(despesaMes)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Resultado do período (DRE simplificado)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: resultadoMes >= 0 ? COLORS.success : COLORS.wine }}>{BRL(resultadoMes)}</p>
        </Card>
      </div>

      <Card className="mb-6">
        <p className="text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>Fluxo de caixa — entrada x saída por mês</p>
        {fluxoPorMes.length === 0 ? (
          <p className="text-sm" style={{ color: COLORS.slate }}>Sem honorário recebido ou despesa paga ainda.</p>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={fluxoPorMes} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={COLORS.line} vertical={false} />
                <XAxis dataKey="nome" tick={{ fill: COLORS.slate, fontSize: 12 }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v) => BRL(v)} contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.line}`, fontFamily: "Inter" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === "entrada" ? "Entrada" : "Saída")} />
                <Bar dataKey="entrada" fill={COLORS.success} radius={[4, 4, 0, 0]} />
                <Bar dataKey="saida" fill={COLORS.wine} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: COLORS.ink }}>
                {["Fornecedor", "Total (período)", "Pago (período)", "A pagar (período)", "Atrasado"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && porFornecedorFiltrado.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>{busca ? "Nenhum fornecedor encontrado." : "Nenhuma despesa cadastrada ainda."}</td></tr>
              )}
              {porFornecedorFiltrado.map((f, i) => (
                <tr key={f.nome} onClick={() => setSelecionado(f.nome)} className="cursor-pointer" style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
                  <td className="px-4 py-3" style={{ color: COLORS.ink, fontWeight: 600 }}>
                    <div className="flex items-center gap-1.5">
                      {f.nome}
                      <FornecedorBell notificacoes={notificacoesPorFornecedor.get(f.nome) ?? []} onMudou={() => { refreshNotificacoes(); }} />
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: COLORS.ink }}>{BRL(f.total)}</td>
                  <td className="px-4 py-3" style={{ color: f.pago ? COLORS.success : COLORS.slate }}>{BRL(f.pago)}</td>
                  <td className="px-4 py-3" style={{ color: f.aPagar ? COLORS.brass : COLORS.slate }}>{BRL(f.aPagar)}</td>
                  <td className="px-4 py-3" style={{ color: f.atrasado ? COLORS.wine : COLORS.slate }}>{BRL(f.atrasado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {fornecedorAberto && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelecionado(null)}>
          <div className="w-full max-w-lg h-full overflow-y-auto p-6" style={{ background: COLORS.paper, borderLeft: `1px solid ${COLORS.line}`, boxShadow: "-20px 0 48px rgba(22,35,59,0.18)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 18, color: COLORS.ink }}>{fornecedorAberto.nome}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing({ fornecedor: fornecedorAberto.nome === "Sem fornecedor" ? "" : fornecedorAberto.nome })} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
                  <Plus size={14} /> Despesa
                </button>
                <button onClick={() => setSelecionado(null)} className="p-2 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
              </div>
            </div>

            <Card className="overflow-hidden !p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>DESCRIÇÃO</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>VALOR</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>VENCIMENTO</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>SITUAÇÃO</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...fornecedorAberto.itens].sort((a, b) => a.vencimento.localeCompare(b.vencimento)).map((d) => (
                      <tr key={d.id} onClick={() => setEditing(d)} className="cursor-pointer" style={{ borderTop: `1px solid ${COLORS.line}` }}>
                        <td className="px-4 py-2" style={{ color: COLORS.ink, fontWeight: 600 }}>
                          {d.descricao}
                          {d.categoria && <span className="block text-xs font-normal" style={{ color: COLORS.slate }}>{d.categoria}</span>}
                        </td>
                        <td className="px-4 py-2" style={{ color: COLORS.ink }}>{BRL(d.valor)}</td>
                        <td className="px-4 py-2" style={{ color: COLORS.slate }}>{new Date(`${d.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                          <StatusPicker
                            value={d.status}
                            options={STATUS_OPTIONS.map((s) => s.value)}
                            tone={{ "Em aberto": estaAtrasado(d) ? "urgent" : "warn", Vencido: "urgent", Pago: "ok" }}
                            onChange={(status) => update(d.id, { status })}
                          />
                          {(d.pix_copia_cola || d.linha_digitavel) && (
                            <button onClick={() => copiarCodigo(d)} title="Copiar código de pagamento" className="flex items-center gap-1 text-xs mt-1" style={{ color: copiado === d.id ? COLORS.success : COLORS.brass }}>
                              {copiado === d.id ? <Check size={11} /> : <Copy size={11} />} {copiado === d.id ? "Copiado" : "Copiar código"}
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <RowActions onEdit={() => setEditing(d)} onDelete={() => remove(d.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      <RecordFormModal
        open={editing !== null}
        title={editing?.id ? "Editar despesa" : "Nova despesa"}
        fields={fields}
        initialValues={editing}
        onClose={() => setEditing(null)}
        onSubmit={salvar}
      />

      {arquivoExtrato && (
        <ImportarExtratoModal arquivo={arquivoExtrato} honorarios={honorarios} despesas={despesas} orgId={orgId} onClose={() => setArquivoExtrato(null)} />
      )}
    </div>
  );
}
