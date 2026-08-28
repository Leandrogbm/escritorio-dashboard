import React, { useState } from "react";
import { Scale, LogOut, FileClock } from "lucide-react";
import Card from "./Card.jsx";
import Stamp from "./Stamp.jsx";
import MovimentacoesPanel from "./MovimentacoesPanel.jsx";
import { COLORS } from "../lib/theme.js";
import { BRL } from "../data/mockData.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";

const STATUS_TONE = { "Em andamento": "ok", "Aguardando decisão": "warn", "Suspenso": "neutral", "Encerrado": "neutral" };

// Área do cliente final: só leitura, só o que é dele (RLS via auth_cliente_id() —
// processos/honorarios/movimentacoes_processo têm policy própria pra isso, não precisa
// filtrar org_id/cliente_id na mão aqui, o banco já devolve só o que pode).
export default function PortalCliente({ clienteAcesso, signOut }) {
  const { data: processos, loading } = useSupabaseTable("processos", { select: "*", orderBy: "created_at", ascending: false });
  const { data: honorarios } = useSupabaseTable("honorarios", { select: "*", orderBy: "vencimento", ascending: false });
  const [vendoAndamentos, setVendoAndamentos] = useState(null);

  const hojeStr = new Date().toISOString().slice(0, 10);
  const estaAtrasado = (h) => h.status === "Vencido" || (h.status === "Em aberto" && h.vencimento < hojeStr);

  return (
    <div className="min-h-screen w-full" style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif" }}>
      <header className="flex items-center justify-between px-4 sm:px-8 py-4" style={{ background: COLORS.paperRaised, borderBottom: `1px solid ${COLORS.line}` }}>
        <div className="flex items-center gap-2 min-w-0" style={{ color: COLORS.slate }}>
          <Scale size={16} className="shrink-0" />
          <span className="text-sm truncate">{clienteAcesso.organizations?.nome ?? "Portal do Cliente"}</span>
        </div>
        <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.slate }}>
          <LogOut size={14} /> Sair
        </button>
      </header>

      <main className="px-4 sm:px-8 py-6 sm:py-8 max-w-3xl mx-auto">
        <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 22, color: COLORS.ink }}>
          Olá, {clienteAcesso.cliente?.nome}
        </p>
        <p className="text-sm mb-6" style={{ color: COLORS.slate }}>Acompanhe seus processos e cobranças por aqui.</p>

        <p className="text-xs uppercase tracking-wide mb-2" style={{ color: COLORS.slate, fontWeight: 600 }}>Seus processos</p>
        {!loading && processos.length === 0 && (
          <p className="text-sm mb-6" style={{ color: COLORS.slate }}>Nenhum processo vinculado ao seu nome ainda.</p>
        )}
        <div className="flex flex-col gap-3 mb-8">
          {processos.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.slate }}>{p.numero}</p>
                  <p className="text-xs uppercase tracking-wide mt-1" style={{ color: COLORS.brassText, fontWeight: 600 }}>{p.area}</p>
                </div>
                <Stamp tone={STATUS_TONE[p.status]}>{p.status}</Stamp>
              </div>
              <button onClick={() => setVendoAndamentos(p)} className="flex items-center gap-1.5 text-xs underline mt-3" style={{ color: COLORS.slate }}>
                <FileClock size={13} /> Ver andamentos
              </button>
            </Card>
          ))}
        </div>

        <p className="text-xs uppercase tracking-wide mb-2" style={{ color: COLORS.slate, fontWeight: 600 }}>Suas cobranças</p>
        {honorarios.length === 0 ? (
          <p className="text-sm" style={{ color: COLORS.slate }}>Nenhuma cobrança registrada ainda.</p>
        ) : (
          <Card className="overflow-hidden !p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr><th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>VALOR</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>VENCIMENTO</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>SITUAÇÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {honorarios.map((h) => (
                    <tr key={h.id} style={{ borderTop: `1px solid ${COLORS.line}` }}>
                      <td className="px-4 py-2 font-semibold" style={{ color: COLORS.ink }}>{BRL(h.valor)}</td>
                      <td className="px-4 py-2" style={{ color: COLORS.slate }}>{new Date(`${h.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-2"><Stamp tone={estaAtrasado(h) ? "urgent" : h.status === "Pago" ? "ok" : "warn"}>{h.status}</Stamp></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      {vendoAndamentos && <MovimentacoesPanel processo={vendoAndamentos} onClose={() => setVendoAndamentos(null)} />}
    </div>
  );
}
