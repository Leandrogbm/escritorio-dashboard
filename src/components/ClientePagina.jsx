import React, { useState } from "react";
import { ArrowLeft, Pencil, Trash2, FolderOpen, Briefcase, DollarSign } from "lucide-react";
import Card from "./Card.jsx";
import StatusPicker from "./StatusPicker.jsx";
import { COLORS } from "../lib/theme.js";
import { BRL } from "../data/mockData.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { formatCelular } from "../lib/celular.js";
import { formatDocumento } from "../lib/documento.js";

const STATUS_PROCESSO = { "Em andamento": "ok", "Aguardando decisão": "warn", "Suspenso": "neutral", "Encerrado": "neutral" };
const STATUS_HONORARIO = { "Em aberto": "warn", "Vencido": "urgent", "Pago": "ok" };

// Página cheia do cliente (não popup — mesmo motivo do ProcessoPagina: popup empilhado em
// cima de popup ficava confuso pra fechar com Esc). Pedido do usuário: clicar no cliente não
// deve só abrir o formulário de edição, tem que mostrar os processos e o financeiro dele
// junto, com a edição de dados acessível dali (botão "Editar", abre o form de sempre).
export default function ClientePagina({ cliente, orgId, podeExcluir, onVoltar, onEditar, onExcluir, onDocumentos }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: processos, update: updateProcesso } = useSupabaseTable("processos", {
    select: "id, numero, area, status, valor", eq: ["cliente_id", cliente.id],
  });
  const { data: honorarios, update: updateHonorario } = useSupabaseTable("honorarios", {
    select: "id, valor, vencimento, status", orderBy: "vencimento", ascending: false, eq: ["cliente_id", cliente.id],
  });
  const [aba, setAba] = useState("processos");

  const totalPago = honorarios.filter((h) => h.status === "Pago").reduce((s, h) => s + Number(h.valor), 0);
  const totalReceber = honorarios.filter((h) => h.status !== "Pago").reduce((s, h) => s + Number(h.valor), 0);

  return (
    <div>
      <button onClick={onVoltar} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: COLORS.slate }}>
        <ArrowLeft size={15} /> Voltar pra Clientes
      </button>

      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 22, color: COLORS.ink }}>{cliente.nome}</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.brassText }}>
            {cliente.tipo === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
            {cliente.documento && ` · ${formatDocumento(cliente.tipo, cliente.documento)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onDocumentos} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
            <FolderOpen size={14} /> Documentos
          </button>
          <button onClick={onEditar} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
            <Pencil size={14} /> Editar dados
          </button>
          {podeExcluir && (
            <button onClick={() => { if (confirm("Excluir este cliente?")) onExcluir(); }} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.wine }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <Card className="mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Celular</p>
            <p className="mt-0.5" style={{ color: COLORS.ink, fontWeight: 600 }}>{cliente.celular ? formatCelular(cliente.celular) : "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Email</p>
            <p className="mt-0.5" style={{ color: COLORS.ink, fontWeight: 600 }}>{cliente.email || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Endereço</p>
            <p className="mt-0.5" style={{ color: COLORS.ink, fontWeight: 600 }}>{cliente.logradouro ? `${cliente.logradouro}, ${cliente.numero || "s/n"} — ${cliente.cidade || ""}/${cliente.uf || ""}` : "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Origem</p>
            <p className="mt-0.5" style={{ color: COLORS.ink, fontWeight: 600 }}>{cliente.origem || "—"}</p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { key: "processos", label: `Processos (${processos.length})`, icon: Briefcase },
          { key: "financeiro", label: "Financeiro", icon: DollarSign },
        ].map((a) => {
          const ativo = aba === a.key;
          return (
            <button
              key={a.key}
              onClick={() => setAba(a.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold"
              style={{ background: ativo ? COLORS.ink : "transparent", color: ativo ? "#fff" : COLORS.ink, border: `1px solid ${ativo ? COLORS.ink : COLORS.line}` }}
            >
              <a.icon size={14} /> {a.label}
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          {aba === "processos" ? (
            <table className="w-full text-sm">
              <thead>
                <tr><th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>PROCESSO</th>
                  <th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>ÁREA</th>
                  <th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>SITUAÇÃO</th>
                  <th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>VALOR DA CAUSA</th>
                </tr>
              </thead>
              <tbody>
                {processos.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center" style={{ color: COLORS.slate }}>Nenhum processo vinculado a esse cliente ainda.</td></tr>
                )}
                {processos.map((p) => (
                  <tr key={p.id} style={{ borderTop: `1px solid ${COLORS.line}` }}>
                    <td className="px-4 py-2.5" style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.inkSoft, fontSize: 12.5 }}>{p.numero}</td>
                    <td className="px-4 py-2.5" style={{ color: COLORS.slate }}>{p.area}</td>
                    <td className="px-4 py-2.5">
                      <StatusPicker value={p.status} options={Object.keys(STATUS_PROCESSO)} tone={STATUS_PROCESSO} onChange={(status) => updateProcesso(p.id, { status })} />
                    </td>
                    <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>{p.valor ? BRL(p.valor) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <>
              <div className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                <p className="text-xs" style={{ color: COLORS.slate }}>Total pago: <strong style={{ color: totalPago ? COLORS.success : COLORS.slate }}>{BRL(totalPago)}</strong></p>
                <p className="text-xs" style={{ color: COLORS.slate }}>Total a receber: <strong style={{ color: totalReceber ? COLORS.brass : COLORS.slate }}>{BRL(totalReceber)}</strong></p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr><th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>VALOR</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>VENCIMENTO</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>SITUAÇÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {honorarios.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center" style={{ color: COLORS.slate }}>Nenhuma cobrança lançada pra esse cliente ainda.</td></tr>
                  )}
                  {honorarios.map((h) => (
                    <tr key={h.id} style={{ borderTop: `1px solid ${COLORS.line}` }}>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: COLORS.ink }}>{BRL(h.valor)}</td>
                      <td className="px-4 py-2.5" style={{ color: COLORS.slate }}>{new Date(`${h.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-2.5">
                        <StatusPicker value={h.status} options={Object.keys(STATUS_HONORARIO)} tone={STATUS_HONORARIO} onChange={(status) => updateHonorario(h.id, { status })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
