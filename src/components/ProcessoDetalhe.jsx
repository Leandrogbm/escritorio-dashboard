import React from "react";
import { X, AlertTriangle, FileClock, ListTodo, Landmark, FileText, Pencil, Trash2 } from "lucide-react";
import Card from "./Card.jsx";
import Stamp from "./Stamp.jsx";
import { COLORS } from "../lib/theme.js";
import { useEscClose } from "../hooks/useEscClose.js";

const STATUS_TONE = { "Em andamento": "ok", "Aguardando decisão": "warn", "Suspenso": "neutral", "Encerrado": "neutral" };

// Visão completa do processo — clicar em qualquer parte do card na lista abre isso, em vez
// de só um dos painéis (Andamentos/Tarefas/Depósitos/Documentos) direto. Esses 4 continuam
// sendo painéis próprios (Kanban, lista de documento... não cabem espremidos aqui dentro),
// mas agora ficam a 1 clique de distância de um lugar só, com o resto da info do processo.
export default function ProcessoDetalhe({ processo: p, atrasos, onClose, onEditar, onExcluir, onAbrirAndamentos, onAbrirTarefas, onAbrirDepositos, onAbrirDocumentos }) {
  useEscClose(onClose);

  const acessos = [
    { label: "Andamentos", icon: FileClock, onClick: onAbrirAndamentos, alerta: p.datajud_status === "erro" },
    { label: "Tarefas", icon: ListTodo, onClick: onAbrirTarefas },
    { label: "Depósitos judiciais", icon: Landmark, onClick: onAbrirDepositos },
    { label: "Documentos", icon: FileText, onClick: onAbrirDocumentos },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-lg h-full overflow-y-auto p-6" style={{ background: COLORS.paper }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.slate }}>{p.numero}</p>
            <p className="mt-1 text-xl" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.ink }}>{p.cliente?.nome ?? "—"}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Stamp tone={STATUS_TONE[p.status]}>{p.status}</Stamp>
            <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
          </div>
        </div>

        {atrasos > 0 && (
          <div className="flex items-center gap-1.5 mb-4 px-3 py-2 rounded-md text-xs" style={{ background: "rgba(155,28,28,0.08)", color: COLORS.wine }}>
            <AlertTriangle size={13} />
            Cliente com {atrasos} honorário{atrasos > 1 ? "s" : ""} em atraso
          </div>
        )}

        <Card className="mb-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Área</p>
              <p className="mt-0.5" style={{ color: COLORS.ink, fontWeight: 600 }}>{p.area}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Responsável</p>
              <p className="mt-0.5" style={{ color: COLORS.ink, fontWeight: 600 }}>{p.responsavel?.nome ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Valor da causa</p>
              <p className="mt-0.5" style={{ color: COLORS.ink, fontWeight: 600 }}>{p.valor ? p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Última verificação</p>
              <p className="mt-0.5" style={{ color: COLORS.ink, fontWeight: 600 }}>{p.ultima_verificacao_datajud ? new Date(p.ultima_verificacao_datajud).toLocaleDateString("pt-BR") : "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: `1px solid ${COLORS.line}` }}>
            <button onClick={onEditar} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
              <Pencil size={14} /> Editar
            </button>
            {onExcluir && (
              <button onClick={() => { if (confirm("Excluir este processo?")) onExcluir(); }} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.wine }}>
                <Trash2 size={14} /> Excluir
              </button>
            )}
          </div>
        </Card>

        <p className="text-xs uppercase tracking-wide mb-2" style={{ color: COLORS.slate, fontWeight: 600 }}>Acessar</p>
        <div className="grid grid-cols-2 gap-3">
          {acessos.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className="card-hoverable flex items-center gap-2.5 px-4 py-3.5 rounded-lg text-left"
              style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}
            >
              <a.icon size={18} color={COLORS.brass} className="shrink-0" />
              <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>{a.label}</span>
              {a.alerta && <AlertTriangle size={13} color={COLORS.wine} className="shrink-0 ml-auto" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
