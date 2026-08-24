import React, { useMemo, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import Stamp from "../Stamp.jsx";
import RowActions from "../RowActions.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../data/mockData.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
import { CATEGORIAS_DESPESA_COMUNS } from "../../config/categoriasDespesa.js";

const STATUS_OPTIONS = [
  { value: "Em aberto", label: "Em aberto" },
  { value: "Vencido", label: "Vencido" },
  { value: "Pago", label: "Pago" },
];
const MES_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const hojeStr = new Date().toISOString().slice(0, 10);
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

  const despesasFiltradas = despesas.filter((d) => d.descricao.toLowerCase().includes(busca.trim().toLowerCase()));

  const totalPago = despesas.filter((d) => d.status === "Pago").reduce((s, d) => s + Number(d.valor), 0);
  const totalAberto = despesas.filter((d) => d.status !== "Pago").reduce((s, d) => s + Number(d.valor), 0);
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

  // DRE simplificado: só o que já foi recebido/pago de verdade (regime caixa, não competência).
  const receitaTotal = honorarios.filter((h) => h.status === "Pago").reduce((s, h) => s + Number(h.valor), 0);
  const despesaTotal = totalPago;
  const resultado = receitaTotal - despesaTotal;

  const fields = [
    { key: "descricao", label: "Descrição" },
    { key: "categoria", label: "Categoria", type: "datalist", options: CATEGORIAS_DESPESA_COMUNS.map((c) => ({ value: c })), optional: true },
    { key: "valor", label: "Valor (R$)", type: "number" },
    { key: "vencimento", label: "Vencimento", type: "date" },
    { key: "status", label: "Situação", type: "select", options: STATUS_OPTIONS },
  ];

  return (
    <div>
      <SectionTitle
        icon={Building2}
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
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Despesas pagas</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.success }}>{BRL(totalPago)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>A pagar</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.brass }}>{BRL(totalAberto)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Em atraso</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.wine }}>{BRL(totalAtrasado)}</p>
          <p className="text-xs mt-1.5" style={{ color: COLORS.slate }}>{atrasadas.length} despesa(s) atrasada(s)</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Receita recebida (total)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.ink }}>{BRL(receitaTotal)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Despesa paga (total)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.ink }}>{BRL(despesaTotal)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Resultado (DRE simplificado)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: resultado >= 0 ? COLORS.success : COLORS.wine }}>{BRL(resultado)}</p>
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
                {["Descrição", "Categoria", "Valor", "Vencimento", "Situação"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>{h.toUpperCase()}</th>
                ))}
                <th style={{ background: COLORS.ink }}></th>
              </tr>
            </thead>
            <tbody>
              {!loading && despesasFiltradas.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>{busca ? "Nenhuma despesa encontrada." : "Nenhuma despesa cadastrada ainda."}</td></tr>
              )}
              {despesasFiltradas.map((d, i) => (
                <tr key={d.id} style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
                  <td className="px-4 py-3" style={{ color: COLORS.ink, fontWeight: 600 }}>{d.descricao}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.slate }}>{d.categoria || "—"}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.ink }}>{BRL(d.valor)}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.slate }}>{new Date(`${d.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3"><Stamp tone={estaAtrasado(d) ? "urgent" : d.status === "Pago" ? "ok" : "warn"}>{d.status}</Stamp></td>
                  <td className="px-2 py-3">
                    <RowActions onEdit={() => setEditing(d)} onDelete={() => remove(d.id)} />
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
        onSubmit={(values) => (editing?.id ? update(editing.id, values) : insert(values))}
      />
    </div>
  );
}
