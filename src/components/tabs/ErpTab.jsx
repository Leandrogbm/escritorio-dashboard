import React, { useMemo, useState } from "react";
import { Calculator, Plus, Copy, Check } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import StatusPicker from "../StatusPicker.jsx";
import RowActions from "../RowActions.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../data/mockData.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
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

// Contas a pagar do escritório (aluguel, salário, fornecedor...) — junto com honorarios
// (contas a receber, já existente em Financeiro) dá fluxo de caixa e DRE simplificado.
// Não é ERP de verdade (sem folha de pagamento, ativo fixo, orçamento) — só o essencial
// pra saber quanto entra, quanto sai, e se sobra.
export default function ErpTab({ orgId }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: despesas, loading, insert, update, remove } = useSupabaseTable("despesas", { eq: orgEq, orderBy: "vencimento", ascending: true });
  const { data: honorarios } = useSupabaseTable("honorarios", { select: "valor, status, vencimento", eq: orgEq });
  const [editing, setEditing] = useState(null);
  const [busca, setBusca] = useState("");
  const [copiado, setCopiado] = useState(null); // id da despesa cujo código acabou de ser copiado

  const copiarCodigo = async (d) => {
    const codigo = d.pix_copia_cola || d.linha_digitavel;
    if (!codigo) return;
    await navigator.clipboard.writeText(codigo);
    setCopiado(d.id);
    setTimeout(() => setCopiado((c) => (c === d.id ? null : c)), 2000);
  };

  const despesasFiltradas = despesas.filter((d) => d.descricao.toLowerCase().includes(busca.trim().toLowerCase()));

  // Igual ao Financeiro: pago/a pagar são só do mês atual — conta que se repete gera vários
  // meses de uma vez (ver `parcelas` em `salvar`), sem isso "A pagar" ficava inflado com
  // meses que nem venceram ainda. Atrasado é sempre geral (atraso não some no fim do mês),
  // e nunca conta em "a pagar" também (regra: em aberto dentro do prazo = a pagar; fora = atrasado).
  const despesasDoMes = despesas.filter((d) => d.vencimento?.slice(0, 7) === mesAtual);
  const totalPago = despesasDoMes.filter((d) => d.status === "Pago").reduce((s, d) => s + Number(d.valor), 0);
  const totalAberto = despesasDoMes.filter((d) => d.status !== "Pago" && !estaAtrasado(d)).reduce((s, d) => s + Number(d.valor), 0);
  const atrasadas = despesas.filter(estaAtrasado);
  const totalAtrasado = atrasadas.reduce((s, d) => s + Number(d.valor), 0);

  // Fluxo de caixa: entrada (honorário pago) x saída (despesa paga), por mês de vencimento.
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

  // DRE simplificado do mês: só o que já foi recebido/pago de verdade (regime caixa, não
  // competência), só vencimento do mês atual — mesmo raciocínio do resto desta aba.
  const receitaMes = honorarios.filter((h) => h.status === "Pago" && h.vencimento?.slice(0, 7) === mesAtual).reduce((s, h) => s + Number(h.valor), 0);
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
    return insert(linhas);
  };

  return (
    <div>
      <SectionTitle
        icon={Calculator}
        title="ERP"
        subtitle="Contas a pagar, fluxo de caixa e resultado do escritório"
        action={
          <button onClick={() => setEditing({})} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
            <Plus size={14} /> Nova despesa
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Despesas pagas (mês)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: totalPago ? COLORS.success : COLORS.slate }}>{BRL(totalPago)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>A pagar (mês)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: totalAberto ? COLORS.brass : COLORS.slate }}>{BRL(totalAberto)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Em atraso (total)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: totalAtrasado ? COLORS.wine : COLORS.slate }}>{BRL(totalAtrasado)}</p>
          <p className="text-xs mt-1.5" style={{ color: COLORS.slate }}>{atrasadas.length} despesa(s) atrasada(s)</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Receita recebida (mês)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: receitaMes ? COLORS.ink : COLORS.slate }}>{BRL(receitaMes)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Despesa paga (mês)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: despesaMes ? COLORS.ink : COLORS.slate }}>{BRL(despesaMes)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Resultado do mês (DRE simplificado)</p>
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
        <div className="px-4 pt-4">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar despesa..."
            className="w-full max-w-xs px-3 py-2 rounded-md text-sm mb-2"
            style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: COLORS.ink }}>
                {["Descrição", "Fornecedor", "Categoria", "Valor", "Vencimento", "Situação"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>{h.toUpperCase()}</th>
                ))}
                <th style={{ background: COLORS.ink }}></th>
              </tr>
            </thead>
            <tbody>
              {!loading && despesasFiltradas.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>{busca ? "Nenhuma despesa encontrada." : "Nenhuma despesa cadastrada ainda."}</td></tr>
              )}
              {despesasFiltradas.map((d, i) => (
                <tr key={d.id} style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
                  <td className="px-4 py-3" style={{ color: COLORS.ink, fontWeight: 600 }}>{d.descricao}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.slate }}>{d.fornecedor || "—"}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.slate }}>{d.categoria || "—"}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.ink }}>{BRL(d.valor)}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.slate }}>{new Date(`${d.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    <StatusPicker
                      value={d.status}
                      options={STATUS_OPTIONS.map((s) => s.value)}
                      tone={{ "Em aberto": estaAtrasado(d) ? "urgent" : "warn", Vencido: "urgent", Pago: "ok" }}
                      onChange={(status) => update(d.id, { status })}
                    />
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1">
                      {(d.pix_copia_cola || d.linha_digitavel) && (
                        <button onClick={() => copiarCodigo(d)} aria-label="Copiar código de pagamento" title="Copiar código de pagamento (Pix/boleto) pra colar no app do banco" className="p-1.5 rounded hover:opacity-70" style={{ color: copiado === d.id ? COLORS.success : COLORS.brass }}>
                          {copiado === d.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      )}
                      <RowActions onEdit={() => setEditing(d)} onDelete={() => remove(d.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <RecordFormModal
        open={editing !== null}
        title={editing?.id ? "Editar despesa" : "Nova despesa"}
        fields={fields}
        initialValues={editing}
        onClose={() => setEditing(null)}
        onSubmit={salvar}
      />
    </div>
  );
}
