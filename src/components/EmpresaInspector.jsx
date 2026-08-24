import React from "react";
import { X, Trash2 } from "lucide-react";
import Card from "./Card.jsx";
import { COLORS } from "../lib/theme.js";
import { BRL } from "../data/mockData.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { useEscClose } from "../hooks/useEscClose.js";
import { supabase } from "../lib/supabaseClient.js";

// Acesso de suporte do platform admin. Processos/honorários continuam só-leitura (corrigir
// de verdade ali é código/banco). Colaboradores e clientes já podem ser excluídos daqui —
// pedido explícito do dono da plataforma, cobertos por RLS (clientes_del) e pela Edge
// Function admin-delete-user, ambas já aceitando is_platform_admin().
function Bloco({ titulo, cols, rows, render, onDelete }) {
  return (
    <Card className="overflow-hidden !p-0">
      <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.slate, borderBottom: `1px solid ${COLORS.line}` }}>{titulo}</p>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {cols.map((c) => <th key={c} className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>{c.toUpperCase()}</th>)}
            {onDelete && <th></th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={cols.length + (onDelete ? 1 : 0)} className="px-4 py-4 text-center" style={{ color: COLORS.slate }}>Vazio.</td></tr>}
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: `1px solid ${COLORS.line}` }}>
              {render(r)}
              {onDelete && (
                <td className="px-2 py-2 text-right">
                  <button onClick={() => onDelete(r)} aria-label="Excluir" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.wine }}>
                    <Trash2 size={13} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </Card>
  );
}

export default function EmpresaInspector({ orgId, orgNome, onClose }) {
  useEscClose(onClose);
  const { data: colaboradores, refresh: refreshColaboradores } = useSupabaseTable("profiles", { select: "id,nome,role,cargo", eq: ["org_id", orgId] });
  const { data: clientes, refresh: refreshClientes } = useSupabaseTable("clientes", { select: "id,nome,tipo,origem", eq: ["org_id", orgId] });
  const { data: processos } = useSupabaseTable("processos", { select: "id,numero,area,status", eq: ["org_id", orgId] });
  const { data: honorarios } = useSupabaseTable("honorarios", { select: "id,valor,vencimento,status", eq: ["org_id", orgId] });

  const excluirColaborador = async (c) => {
    if (!confirm(`Excluir o colaborador "${c.nome}"? A conta de login dele também é apagada.`)) return;
    const { error } = await supabase.functions.invoke("admin-delete-user", { body: { userId: c.id } });
    if (error) {
      const body = await error.context?.json?.().catch(() => null);
      alert(body?.error ?? error.message);
      return;
    }
    await refreshColaboradores();
  };

  const excluirCliente = async (c) => {
    if (!confirm(`Excluir o cliente "${c.nome}"? Se ele tiver processos vinculados, a exclusão é bloqueada.`)) return;
    const { error } = await supabase.from("clientes").delete().eq("id", c.id);
    if (error) return alert(error.message);
    await refreshClientes();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="w-full max-w-2xl h-full overflow-y-auto p-6" style={{ background: COLORS.paper, borderLeft: `1px solid ${COLORS.line}`, boxShadow: "-20px 0 48px rgba(22,35,59,0.18)" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 18, color: COLORS.ink }}>{orgNome}</p>
            <p className="text-xs" style={{ color: COLORS.slate }}>Acesso de suporte da plataforma</p>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
        </div>

        <div className="flex flex-col gap-4">
          <Bloco titulo="Colaboradores" cols={["Nome", "Perfil", "Cargo"]} rows={colaboradores} onDelete={excluirColaborador}
            render={(r) => <>
              <td className="px-4 py-2">{r.nome}</td>
              <td className="px-4 py-2">{r.role}</td>
              <td className="px-4 py-2">{r.cargo || "—"}</td>
            </>} />
          <Bloco titulo="Clientes" cols={["Nome", "Tipo", "Origem"]} rows={clientes} onDelete={excluirCliente}
            render={(r) => <>
              <td className="px-4 py-2">{r.nome}</td>
              <td className="px-4 py-2">{r.tipo}</td>
              <td className="px-4 py-2">{r.origem || "—"}</td>
            </>} />
          <Bloco titulo="Processos (somente leitura)" cols={["Número", "Área", "Situação"]} rows={processos}
            render={(r) => <>
              <td className="px-4 py-2">{r.numero}</td>
              <td className="px-4 py-2">{r.area}</td>
              <td className="px-4 py-2">{r.status}</td>
            </>} />
          <Bloco titulo="Honorários (somente leitura)" cols={["Valor", "Vencimento", "Situação"]} rows={honorarios}
            render={(r) => <>
              <td className="px-4 py-2">{BRL(r.valor)}</td>
              <td className="px-4 py-2">{r.vencimento}</td>
              <td className="px-4 py-2">{r.status}</td>
            </>} />
        </div>
      </div>
    </div>
  );
}
