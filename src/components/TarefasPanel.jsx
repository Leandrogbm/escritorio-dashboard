import React, { useState } from "react";
import { X, Plus, ChevronRight, ChevronLeft, Trash2, Sparkles } from "lucide-react";
import Card from "./Card.jsx";
import { COLORS } from "../lib/theme.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { useEscClose } from "../hooks/useEscClose.js";
import { supabase } from "../lib/supabaseClient.js";

// Kanban de tarefas do processo — 3 colunas fixas. Mover é um update de status, disparado por
// arrastar o card (mouse, HTML5 drag nativo) OU pelos botões "→"/"←" (mantidos pra touch, onde
// drag nativo não funciona direito).
const COLUNAS = ["A fazer", "Em andamento", "Concluída"];

// `embutido`: true quando usado como aba dentro de ProcessoPagina (sem moldura de modal,
// sem Esc próprio — a página é que trata Esc/fechar). false = continua funcionando como
// popup solto (compatibilidade, não tem outro lugar usando assim hoje mas deixa pronto).
export default function TarefasPanel({ processo, equipe, orgId, onClose, embutido = false }) {
  useEscClose(onClose, !embutido);
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: tarefas, insert, update, remove } = useSupabaseTable("tarefas", {
    select: "*, responsavel:profiles(id,nome)", eq: orgEq, orderBy: "created_at", ascending: true,
  });
  const doProcesso = tarefas.filter((t) => t.processo_id === processo.id);
  const [formAberto, setFormAberto] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoResponsavel, setNovoResponsavel] = useState("");
  const [checklist, setChecklist] = useState(null); // array de strings sugeridas pela IA, ou null
  const [checklistMarcadas, setChecklistMarcadas] = useState(new Set());
  const [sugerindo, setSugerindo] = useState(false);
  const [erroChecklist, setErroChecklist] = useState("");

  const sugerirChecklist = async () => {
    setSugerindo(true);
    setErroChecklist("");
    const { data, error } = await supabase.functions.invoke("sugerir-checklist", { body: { area: processo.area, numero: processo.numero } });
    setSugerindo(false);
    if (error) {
      setErroChecklist((await error.context?.json?.().catch(() => null))?.error ?? error.message);
      return;
    }
    setChecklist(data.checklist);
    setChecklistMarcadas(new Set(data.checklist.map((_, i) => i)));
  };

  const alternarMarcada = (i) => setChecklistMarcadas((s) => {
    const novo = new Set(s);
    if (novo.has(i)) novo.delete(i); else novo.add(i);
    return novo;
  });

  const adicionarChecklist = async () => {
    const titulos = checklist.filter((_, i) => checklistMarcadas.has(i));
    if (titulos.length === 0) return setChecklist(null);
    await insert(titulos.map((titulo) => ({ processo_id: processo.id, titulo })));
    setChecklist(null);
  };

  const criar = async (e) => {
    e.preventDefault();
    if (!novoTitulo.trim()) return;
    await insert({ processo_id: processo.id, titulo: novoTitulo.trim(), descricao: novaDescricao.trim() || null, responsavel_id: novoResponsavel || null });
    setNovoTitulo("");
    setNovaDescricao("");
    setNovoResponsavel("");
    setFormAberto(false);
  };

  const mover = (tarefa, delta) => {
    const i = COLUNAS.indexOf(tarefa.status) + delta;
    if (i < 0 || i >= COLUNAS.length) return;
    update(tarefa.id, { status: COLUNAS[i] });
  };

  const soltar = (coluna, e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) update(id, { status: coluna });
  };

  const conteudo = (
    <>
          {!embutido && (
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 16, color: COLORS.ink }}>{processo.numero}</p>
                <p className="text-xs" style={{ color: COLORS.slate }}>Tarefas</p>
              </div>
              <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
            </div>
          )}

          {!formAberto && !checklist && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <button onClick={() => setFormAberto(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
                <Plus size={14} /> Nova tarefa
              </button>
              {doProcesso.length === 0 && (
                <button onClick={sugerirChecklist} disabled={sugerindo} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, opacity: sugerindo ? 0.6 : 1 }}>
                  <Sparkles size={14} color={COLORS.brass} /> {sugerindo ? "Gerando..." : "Sugerir checklist (IA)"}
                </button>
              )}
            </div>
          )}
          {erroChecklist && <p className="text-xs mb-3" style={{ color: COLORS.wine }}>{erroChecklist}</p>}

          {checklist && (
            <Card className="mb-5" style={{ background: "rgba(165,121,59,0.06)", borderColor: "rgba(165,121,59,0.3)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: COLORS.ink }}>
                  <Sparkles size={13} color={COLORS.brass} /> Checklist sugerido — desmarque o que não quiser adicionar
                </p>
                <button onClick={() => setChecklist(null)} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={16} /></button>
              </div>
              <div className="flex flex-col gap-1.5 mb-3">
                {checklist.map((item, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm" style={{ color: COLORS.ink }}>
                    <input type="checkbox" checked={checklistMarcadas.has(i)} onChange={() => alternarMarcada(i)} />
                    {item}
                  </label>
                ))}
              </div>
              <button onClick={adicionarChecklist} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
                <Plus size={14} /> Adicionar {checklistMarcadas.size} tarefa(s)
              </button>
            </Card>
          )}

          {formAberto && (
            <form onSubmit={criar} className="flex flex-col gap-2 mb-5 p-3 rounded-md" style={{ border: `1px solid ${COLORS.line}` }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Nova tarefa</p>
                <button type="button" onClick={() => setFormAberto(false)} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={16} /></button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  placeholder="Título da tarefa..."
                  autoFocus
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
              </div>
              <textarea
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                placeholder="Descrição (opcional)..."
                rows={2}
                className="w-full px-3 py-2 rounded-md text-sm resize-y"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
              />
              <button type="submit" className="self-end flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
                <Plus size={14} /> Adicionar
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {COLUNAS.map((coluna, ci) => (
              <div key={coluna}>
                <p className="text-xs uppercase tracking-wide mb-2" style={{ color: COLORS.slate, fontWeight: 600 }}>
                  {coluna} ({doProcesso.filter((t) => t.status === coluna).length})
                </p>
                <div
                  className="flex flex-col gap-2 min-h-[40px] rounded-md"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => soltar(coluna, e)}
                >
                  {doProcesso.filter((t) => t.status === coluna).map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                      className="p-2.5 rounded-md text-sm cursor-grab active:cursor-grabbing"
                      style={{ border: `1px solid ${COLORS.line}`, background: COLORS.paperRaised }}
                    >
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
    </>
  );

  if (embutido) return conteudo;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card style={{ boxShadow: "0 20px 48px rgba(22,35,59,0.22)" }}>
          {conteudo}
        </Card>
      </div>
    </div>
  );
}
