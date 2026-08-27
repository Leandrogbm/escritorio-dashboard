import React, { useMemo, useState } from "react";
import { Trello, Plus, ChevronRight, ChevronLeft, Trash2, X } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import TrelloQuadro from "../TrelloQuadro.jsx";
import { COLORS } from "../../lib/theme.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";

// Quadro geral de tarefas (mesma tabela `tarefas` do Kanban por processo, ver TarefasPanel.jsx)
// — aqui agrupado por advogado responsável em vez de por processo, pra dar visão "o que cada
// um da equipe tem na mão" sem precisar abrir processo por processo. Sócio/admin vê o quadro
// geral (todo mundo); advogado vê só o próprio quadro — não é RLS (a tabela `tarefas` já
// devolve tudo que a org permite), é filtro de exibição mesmo.
const COLUNAS = [
  { nome: "A fazer", cor: "#2563a3" },
  { nome: "Em andamento", cor: COLORS.brass },
  { nome: "Concluída", cor: COLORS.success },
];

export default function QuadroTab({ orgId, currentRole, profile }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  // Trello conectado com um quadro escolhido (Configurações → Integrações) — quando tiver,
  // essa aba mostra o quadro real do Trello (listas + cards, ao vivo via trello-proxy) em vez
  // do Kanban do Actum. Não dá pra embutir via iframe (Trello bloqueia isso por CSP própria).
  // "trello_conectado" é só um boolean público em organizations (qualquer cargo pode ler) —
  // a Key/Token de verdade mora em `integracoes`, RLS admin/sócio, e nunca chega aqui.
  const { data: orgRows } = useSupabaseTable("organizations", { select: "trello_conectado", eq: orgId ? ["id", orgId] : undefined });
  const trelloConectado = orgRows[0]?.trello_conectado;

  const { data: tarefas, insert, update, remove } = useSupabaseTable("tarefas", {
    select: "*, responsavel:profiles(id,nome), processo:processos(id,numero)", eq: orgEq, orderBy: "created_at", ascending: true,
  });
  const { data: equipe } = useSupabaseTable("profiles", { select: "id,nome", orderBy: "nome", ascending: true, eq: orgEq });
  const { data: processos } = useSupabaseTable("processos", { select: "id,numero", orderBy: "numero", ascending: true, eq: orgEq });

  // Só sócio vê o quadro geral (todo mundo) — admin, mesmo enxergando tudo no resto do
  // sistema, aqui é tratado como "mais um da equipe" e só vê as próprias tarefas, igual
  // qualquer outro cargo. Pedido explícito do usuário.
  const vejaTudo = currentRole === "socio";

  const [formAberto, setFormAberto] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoResponsavel, setNovoResponsavel] = useState(vejaTudo ? "" : (profile?.id ?? ""));
  const [novoProcesso, setNovoProcesso] = useState("");

  const porAdvogado = useMemo(() => {
    const grupos = new Map(equipe.map((e) => [e.id, { pessoa: e, tarefas: [] }]));
    grupos.set(null, { pessoa: { id: null, nome: "Sem responsável" }, tarefas: [] });
    for (const t of tarefas) {
      const chave = t.responsavel_id ?? null;
      if (!grupos.has(chave)) grupos.set(chave, { pessoa: t.responsavel ?? { id: chave, nome: "—" }, tarefas: [] });
      grupos.get(chave).tarefas.push(t);
    }
    const todos = [...grupos.values()].filter((g) => g.pessoa.id !== null || g.tarefas.length > 0);
    return vejaTudo ? todos : todos.filter((g) => g.pessoa.id === profile?.id);
  }, [equipe, tarefas, vejaTudo, profile?.id]);

  const criar = async (e) => {
    e.preventDefault();
    if (!novoTitulo.trim() || !novoProcesso) return;
    await insert({ processo_id: novoProcesso, titulo: novoTitulo.trim(), descricao: novaDescricao.trim() || null, responsavel_id: novoResponsavel || null });
    setNovoTitulo("");
    setNovaDescricao("");
    if (vejaTudo) setNovoResponsavel("");
    setNovoProcesso("");
    setFormAberto(false);
  };

  const nomesColunas = COLUNAS.map((c) => c.nome);
  const mover = (tarefa, delta) => {
    const i = nomesColunas.indexOf(tarefa.status) + delta;
    if (i < 0 || i >= COLUNAS.length) return;
    update(tarefa.id, { status: nomesColunas[i] });
  };

  const soltar = (coluna, e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) update(id, { status: coluna });
  };

  if (trelloConectado) {
    return (
      <div>
        <SectionTitle icon={Trello} title="Quadro de tarefas" subtitle="Conectado ao Trello — listas e cartões ao vivo" />
        <TrelloQuadro />
      </div>
    );
  }

  return (
    <div>
      <SectionTitle
        icon={Trello}
        title="Quadro de tarefas"
        subtitle={vejaTudo ? "Atividades da equipe, por advogado" : "Suas atividades"}
        action={!formAberto && (
          <button onClick={() => setFormAberto(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
            <Plus size={14} /> Nova tarefa
          </button>
        )}
      />

      {formAberto && (
        <Card className="mb-5">
          <form onSubmit={criar} className="flex flex-col gap-2">
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
              <select value={novoProcesso} onChange={(e) => setNovoProcesso(e.target.value)} required className="px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
                <option value="">Processo...</option>
                {processos.map((p) => <option key={p.id} value={p.id}>{p.numero}</option>)}
              </select>
              {vejaTudo && (
                <select value={novoResponsavel} onChange={(e) => setNovoResponsavel(e.target.value)} className="px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
                  <option value="">Sem responsável</option>
                  {equipe.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              )}
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
        </Card>
      )}

      <div className="flex flex-col gap-5">
        {porAdvogado.length === 0 && (
          <p className="text-sm" style={{ color: COLORS.slate }}>Nenhuma tarefa por aqui ainda.</p>
        )}
        {porAdvogado.map(({ pessoa, tarefas: doAdvogado }) => (
          <Card key={pessoa.id ?? "sem-responsavel"}>
            {vejaTudo && <p className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>{pessoa.nome}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {COLUNAS.map((coluna, ci) => (
                <div key={coluna.nome}>
                  <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-md" style={{ background: coluna.cor }}>
                    <p className="text-xs font-semibold" style={{ color: "#fff" }}>{coluna.nome}</p>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>{doAdvogado.filter((t) => t.status === coluna.nome).length}</span>
                  </div>
                  <div
                    className="flex flex-col gap-2 min-h-[40px] rounded-md"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => soltar(coluna.nome, e)}
                  >
                    {doAdvogado.filter((t) => t.status === coluna.nome).map((t) => (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                        className="p-2.5 rounded-md text-sm cursor-grab active:cursor-grabbing"
                        style={{ border: `1px solid ${COLORS.line}`, background: COLORS.paperRaised }}
                      >
                        <p style={{ color: COLORS.ink }}>{t.titulo}</p>
                        {t.descricao && <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: COLORS.slate }}>{t.descricao}</p>}
                        <p className="text-xs mt-0.5" style={{ color: COLORS.slate }}>{t.processo?.numero ?? "—"}</p>
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
        ))}
      </div>
    </div>
  );
}
