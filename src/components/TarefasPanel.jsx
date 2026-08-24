import React, { useState } from "react";
import { X, Plus, ChevronRight, ChevronLeft, Trash2 } from "lucide-react";
import Card from "./Card.jsx";
import { COLORS } from "../lib/theme.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";

// Kanban de tarefas do processo — 3 colunas fixas, sem drag&drop (botão "→"/"←" move de
// coluna, mais simples e funciona igual em touch); mover é só um update de status.
const COLUNAS = ["A fazer", "Em andamento", "Concluída"];

export default function TarefasPanel({ processo, equipe, orgId, onClose }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: tarefas, insert, update, remove } = useSupabaseTable("tarefas", {
    select: "*, responsavel:profiles(id,nome)", eq: orgEq, orderBy: "created_at", ascending: true,
  });
  const doProcesso = tarefas.filter((t) => t.processo_id === processo.id);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoResponsavel, setNovoResponsavel] = useState("");

  const criar = async (e) => {
    e.preventDefault();
    if (!novoTitulo.trim()) return;
    await insert({ processo_id: processo.id, titulo: novoTitulo.trim(), descricao: novaDescricao.trim() || null, responsavel_id: novoResponsavel || null });
    setNovoTitulo("");
    setNovaDescricao("");
    setNovoResponsavel("");
  };

  const mover = (tarefa, delta) => {
    const i = COLUNAS.indexOf(tarefa.status) + delta;
    if (i < 0 || i >= COLUNAS.length) return;
    update(tarefa.id, { status: COLUNAS[i] });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 16, color: COLORS.ink }}>{processo.numero}</p>
              <p className="text-xs" style={{ color: COLORS.slate }}>Tarefas</p>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
          </div>

          <form onSubmit={criar} className="flex flex-col gap-2 mb-5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={novoTitulo}
                onChange={(e) => setNovoTitulo(e.target.value)}
                placeholder="Nova tarefa..."
                className="flex-1 min-w-[160px] px-3 py-2 rounded-md text-sm"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
              />
              <select
                value={novoResponsavel}
                onChange={(e) => setNovoResponsavel(e.target.value)}
                className="px-3 py-2 rounded-md text-sm"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
              >
                <option value="">Sem responsável</option>
                {equipe.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
              <button type="submit" className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
                <Plus size={14} /> Adicionar
              </button>
            </div>
            <textarea
              value={novaDescricao}
              onChange={(e) => setNovaDescricao(e.target.value)}
              placeholder="Descrição (opcional)..."
              rows={2}
              className="w-full px-3 py-2 rounded-md text-sm resize-y"
              style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
            />
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {COLUNAS.map((coluna, ci) => (
              <div key={coluna}>
                <p className="text-xs uppercase tracking-wide mb-2" style={{ color: COLORS.slate, fontWeight: 600 }}>
                  {coluna} ({doProcesso.filter((t) => t.status === coluna).length})
                </p>
                <div className="flex flex-col gap-2 min-h-[40px]">
                  {doProcesso.filter((t) => t.status === coluna).map((t) => (
                    <div key={t.id} className="p-2.5 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, background: COLORS.paperRaised }}>
                      <p style={{ color: COLORS.ink }}>{t.titulo}</p>
                      {t.descricao && <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: COLORS.slate }}>{t.descricao}</p>}
                      <p className="text-xs mt-0.5" style={{ color: COLORS.slate }}>{t.responsavel?.nome ?? "Sem responsável"}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => mover(t, -1)} disabled={ci === 0} aria-label="Mover pra trás" className="p-1 rounded hover:opacity-70 disabled:opacity-20" style={{ color: COLORS.slate }}>
                            <ChevronLeft size={14} />
                          </button>
                          <button onClick={() => mover(t, 1)} disabled={ci === COLUNAS.length - 1} aria-label="Mover pra frente" className="p-1 rounded hover:opacity-70 disabled:opacity-20" style={{ color: COLORS.slate }}>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                        <button onClick={() => remove(t.id)} aria-label="Excluir tarefa" className="p-1 rounded hover:opacity-70" style={{ color: COLORS.wine }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
