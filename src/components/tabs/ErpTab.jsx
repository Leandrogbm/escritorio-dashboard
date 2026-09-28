import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calculator, Plus, Copy, Check, Upload, X, TrendingUp, Wallet, CheckCircle2, Clock3, AlertTriangle, Scale, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import ExecutivoTab from "./ExecutivoTab.jsx";
import CaixaErp from "./CaixaErp.jsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Card from "../Card.jsx";
import KpiCard from "../KpiCard.jsx";
import SectionTitle from "../SectionTitle.jsx";
import StatusPicker from "../StatusPicker.jsx";
import RowActions from "../RowActions.jsx";
import { TableHead, Tr } from "../TableList.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import SearchInput from "../SearchInput.jsx";
import ImportarExtratoModal from "./ImportarExtratoModal.jsx";
import FornecedorBell from "../FornecedorBell.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../lib/format.js";
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
// Data local ("sv" = AAAA-MM-DD), não UTC — depois das 21h o UTC já é o dia seguinte.
const hojeStr = new Date().toLocaleDateString("sv");
const mesAtual = hojeStr.slice(0, 7);
const estaAtrasado = (d) => d.status === "Vencido" || (d.status === "Em aberto" && d.vencimento < hojeStr);
const chaveFornecedor = (d) => (d.fornecedor || "").trim() || "Sem fornecedor";
// Mesma lógica do "pior caso vira lombada da linha" do Financeiro — atrasado > a pagar >
// pago > neutro, resumido pro fornecedor inteiro em vez de uma despesa só.
const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (m) => `${NOMES_MES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;
const somaMes = (m, n) => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1).toLocaleDateString("sv").slice(0, 7);
const toneDoFornecedor = (f) => (f.atrasado > 0 ? "urgent" : f.aPagar > 0 ? "warn" : f.pago > 0 ? "ok" : "neutral");

// Contas a pagar do escritório (aluguel, salário, fornecedor...) — junto com honorarios
// (contas a receber, já existente em Financeiro) dá fluxo de caixa e DRE simplificado.
// Não é ERP de verdade (sem folha de pagamento, ativo fixo, orçamento) — só o essencial
// pra saber quanto entra, quanto sai, e se sobra.
export default function ErpTab({ orgId }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  // Visão Executiva vira sub-aba daqui — pedido do usuário ("visão executiva tem que ser um
  // adereço dentro do ERP"). "despesas" continua a aba principal (é o que o ERP faz no dia a
  // dia); "visao" mostra o painel executivo (ExecutivoTab.jsx embutido).
  // Três abas com um papel cada: "pagar" (contas do dia a dia), "caixa" (entrou x saiu e
  // resultado do mês) e "visao" (painel executivo embutido).
  const [aba, setAba] = useState("pagar");
  const { data: despesas, loading, insert, update, remove } = useSupabaseTable("despesas", { eq: orgEq, orderBy: "vencimento", ascending: true });
  const { data: honorarios } = useSupabaseTable("honorarios", { select: "id, cliente:clientes(id,nome), processo:processos(area), valor, status, vencimento, descricao_servico", eq: orgEq });
  const { data: notificacoesTodas, refresh: refreshNotificacoes } = useSupabaseTable("notificacoes", { select: "id, tipo, despesa_id, titulo, texto", eq: orgEq });
  const [editing, setEditing] = useState(null);
  const [selecionado, setSelecionado] = useState(null); // fornecedor (chave) aberto no painel de detalhe
  const [busca, setBusca] = useState("");
  const [mes, setMes] = useState(mesAtual); // mês de referência das abas Contas a pagar e Caixa
  const [arquivoExtrato, setArquivoExtrato] = useState(null);
  const fileInputRef = useRef(null);
  const [copiado, setCopiado] = useState(null); // id da despesa cujo código acabou de ser copiado
  const [verTudoItens, setVerTudoItens] = useState(false); // painel do fornecedor: mostrar todos os meses em vez de só o período + atrasadas
  useEffect(() => { setVerTudoItens(false); }, [selecionado]); // cada fornecedor aberto começa no modo período
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

  const dentroDoPeriodo = (d) => d.vencimento?.slice(0, 7) === mes;

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
  }, [despesas, mes]);

  const fornecedorAberto = porFornecedor.find((f) => f.nome === selecionado) ?? null;
  // Só fornecedor com algo no mês ou em atraso — conta de outro mês sem pendência é ruído.
  const porFornecedorFiltrado = porFornecedor
    .filter((f) => f.total > 0 || f.atrasado > 0)
    .filter((f) => f.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  // Painel do fornecedor: por padrão só o que vence no período selecionado + o que está
  // atrasado (visão "contas a pagar" de ERP), não o histórico de todos os meses.
  const periodoLabel = nomeMes(mes);
  const itensDoFornecedor = (fornecedorAberto?.itens ?? [])
    .filter((d) => verTudoItens || dentroDoPeriodo(d) || estaAtrasado(d))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const itensOcultos = (fornecedorAberto?.itens.length ?? 0) - itensDoFornecedor.length;
  const aPagarVisivel = itensDoFornecedor.filter((d) => d.status !== "Pago").reduce((s, d) => s + Number(d.valor), 0);

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
        subtitle="Contas a pagar e caixa do escritório"
        action={aba === "pagar" && (
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar fornecedor..." />
            <button onClick={escolherArquivoExtrato} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
              <Upload size={14} /> Importar extrato
            </button>
            <input ref={fileInputRef} type="file" accept=".ofx,.csv,.txt,.pdf,image/*" className="hidden" onChange={arquivoExtratoEscolhido} />
            <button onClick={() => setEditing({})} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
              <Plus size={14} /> Nova despesa
            </button>
          </div>
        )}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "pagar", label: "Contas a pagar", icon: Receipt },
            { key: "caixa", label: "Caixa do mês", icon: Wallet },
            { key: "visao", label: "Visão geral", icon: TrendingUp },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setAba(t.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold"
              style={{ background: aba === t.key ? COLORS.ink : "transparent", color: aba === t.key ? "#fff" : COLORS.ink, border: `1px solid ${aba === t.key ? COLORS.ink : COLORS.line}` }}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
        {aba !== "visao" && (
          <div className="flex items-center gap-1 rounded-md" style={{ border: `1px solid ${COLORS.line}` }}>
            <button onClick={() => setMes((m) => somaMes(m, -1))} aria-label="Mês anterior" className="p-2 hover:opacity-70" style={{ color: COLORS.slate }}><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold px-1 min-w-[130px] text-center" style={{ color: COLORS.ink }}>{nomeMes(mes)}</span>
            <button onClick={() => setMes((m) => somaMes(m, 1))} aria-label="Próximo mês" className="p-2 hover:opacity-70" style={{ color: COLORS.slate }}><ChevronRight size={16} /></button>
            {mes !== mesAtual && (
              <button onClick={() => setMes(mesAtual)} className="text-xs font-semibold px-2" style={{ color: COLORS.brassText }}>Mês atual</button>
            )}
          </div>
        )}
      </div>

      {aba === "visao" && <ExecutivoTab orgId={orgId} embutido />}

      {aba === "caixa" && <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <KpiCard icon={CheckCircle2} tone="success" label="Entrou (honorários recebidos)" value={BRL(receitaMes)} valueColor={receitaMes ? COLORS.success : COLORS.slate} />
          <KpiCard icon={Wallet} tone="wine" label="Saiu (despesas pagas)" value={BRL(despesaMes)} valueColor={despesaMes ? COLORS.wine : COLORS.slate} />
          <KpiCard icon={Scale} tone={resultadoMes >= 0 ? "success" : "wine"} label="Sobrou no mês" value={BRL(resultadoMes)} valueColor={resultadoMes >= 0 ? COLORS.success : COLORS.wine} caption="Só o que já foi recebido e pago de verdade" />
        </div>
        <Card>
          <p className="text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>Entrou x saiu, mês a mês</p>
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
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === "entrada" ? "Entrou" : "Saiu")} />
                  <Bar dataKey="entrada" fill={COLORS.success} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saida" fill={COLORS.wine} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <CaixaErp mes={mes} honorarios={honorarios} despesas={despesas} />
      </>}

      {aba === "pagar" && <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard icon={Clock3} tone={totalAberto ? "brass" : "slate"} label="A pagar no mês" value={BRL(totalAberto)} valueColor={totalAberto ? COLORS.brass : COLORS.slate} />
        <KpiCard icon={AlertTriangle} tone={totalAtrasado ? "wine" : "slate"} label="Em atraso" value={BRL(totalAtrasado)} valueColor={totalAtrasado ? COLORS.wine : COLORS.slate} caption={atrasadas.length ? `${atrasadas.length} conta(s) atrasada(s)` : "Nenhuma conta atrasada"} />
        <KpiCard icon={CheckCircle2} tone={totalPago ? "success" : "slate"} label="Já pago no mês" value={BRL(totalPago)} valueColor={totalPago ? COLORS.success : COLORS.slate} />
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <TableHead columns={["Fornecedor", "A pagar no mês", "Em atraso", "Pago no mês"]} />
            <tbody>
              {!loading && porFornecedorFiltrado.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>{busca ? "Nenhum fornecedor encontrado." : despesas.length ? `Nenhuma conta em ${periodoLabel}.` : "Nenhuma despesa cadastrada ainda."}</td></tr>
              )}
              {porFornecedorFiltrado.map((f) => (
                <Tr key={f.nome} onClick={() => setSelecionado(f.nome)} tone={toneDoFornecedor(f)}>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 600, fontSize: 15, color: COLORS.ink }}>{f.nome}</p>
                      <FornecedorBell notificacoes={notificacoesPorFornecedor.get(f.nome) ?? []} onMudou={() => { refreshNotificacoes(); }} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5" style={{ color: f.aPagar ? COLORS.brass : COLORS.slate }}>{BRL(f.aPagar)}</td>
                  <td className="px-4 py-3.5" style={{ color: f.atrasado ? COLORS.wine : COLORS.slate }}>{BRL(f.atrasado)}</td>
                  <td className="px-4 py-3.5" style={{ color: f.pago ? COLORS.success : COLORS.slate }}>{BRL(f.pago)}</td>
                </Tr>
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

            <div className="flex items-center justify-between mb-3 text-sm gap-3">
              <span style={{ color: COLORS.slate }}>
                {verTudoItens ? "Todas as contas" : `Vence em ${periodoLabel} + atrasadas`} · <strong style={{ color: COLORS.brass }}>{BRL(aPagarVisivel)}</strong> em aberto
              </span>
              {(itensOcultos > 0 || verTudoItens) && (
                <button onClick={() => setVerTudoItens((v) => !v)} className="text-xs underline whitespace-nowrap" style={{ color: COLORS.slate }}>
                  {verTudoItens ? "Ver só o período" : `Ver todas (+${itensOcultos})`}
                </button>
              )}
            </div>

            <Card className="overflow-hidden !p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <TableHead columns={["Descrição", "Valor", "Vencimento", "Situação", ""]} />
                  <tbody>
                    {itensDoFornecedor.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>Nada vencendo em {periodoLabel}.</td></tr>
                    )}
                    {itensDoFornecedor.map((d) => (
                      <Tr key={d.id} onClick={() => setEditing(d)} tone={estaAtrasado(d) ? "urgent" : d.status === "Pago" ? "ok" : "warn"}>
                        <td className="px-4 py-3" style={{ color: COLORS.ink, fontWeight: 600 }}>
                          {d.descricao}
                          {d.categoria && <span className="block text-xs font-normal" style={{ color: COLORS.slate }}>{d.categoria}</span>}
                        </td>
                        <td className="px-4 py-3" style={{ color: COLORS.ink }}>{BRL(d.valor)}</td>
                        <td className="px-4 py-3" style={{ color: COLORS.slate }}>{new Date(`${d.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <RowActions onEdit={() => setEditing(d)} onDelete={() => remove(d.id)} />
                        </td>
                      </Tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}
      </>}

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
