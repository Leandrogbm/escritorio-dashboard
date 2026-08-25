import React, { useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { COLORS } from "../lib/theme.js";

// Mostra o quadro do Trello DE VERDADE (não é cópia/mirror local) — busca listas e cards
// direto na API a cada abertura da aba, e toda ação (arrastar, criar, excluir) chama a
// API na hora. Pedido do usuário depois de eu tentar embutir via iframe e a Trello bloquear
// isso por CSP própria (frame-ancestors só libera Teams/Outlook/Bing) — isso aqui é a
// alternativa real: não é o widget do Trello, é a MESMA informação, ao vivo.
//
// Visual imita o Trello de propósito (coluna cinza clara, card branco com sombra) — pedido
// do usuário pra ficar reconhecível pra quem já usa o Trello todo dia. Descrição do card
// trunca em 4 linhas (comprovante/intimação colado inteiro no card vira parede de texto
// enorme) e quebra qualquer palavra/URL sem espaço, senão uma linha sem quebra (link longo)
// estoura a largura fixa da coluna e derruba o layout inteiro — foi exatamente o bug visto.
const TRELLO_BG = "#F1F2F4";
const clampStyle = { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" };

export default function TrelloQuadro({ trelloKey, trelloToken, boardId }) {
  const [listas, setListas] = useState(null);
  const [cards, setCards] = useState(null);
  const [erro, setErro] = useState("");
  const [novaTarefaEm, setNovaTarefaEm] = useState(null); // id da lista com o form aberto
  const [novoTitulo, setNovoTitulo] = useState("");

  const q = `key=${trelloKey}&token=${trelloToken}`;

  const carregar = async () => {
    setErro("");
    try {
      const [resListas, resCards] = await Promise.all([
        fetch(`https://api.trello.com/1/boards/${boardId}/lists?${q}&fields=name`),
        fetch(`https://api.trello.com/1/boards/${boardId}/cards?${q}&fields=name,desc,idList`),
      ]);
      if (!resListas.ok || !resCards.ok) throw new Error(await (!resListas.ok ? resListas : resCards).text());
      setListas(await resListas.json());
      setCards(await resCards.json());
    } catch (err) {
      setErro(`Não consegui carregar o quadro do Trello: "${err.message}".`);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const moverCard = async (cardId, idList) => {
    setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, idList } : c))); // otimista
    await fetch(`https://api.trello.com/1/cards/${cardId}?${q}&idList=${idList}`, { method: "PUT" });
  };

  const criarCard = async (idList) => {
    if (!novoTitulo.trim()) return;
    const res = await fetch(`https://api.trello.com/1/cards?${q}&idList=${idList}&name=${encodeURIComponent(novoTitulo.trim())}`, { method: "POST" });
    const novo = await res.json();
    setCards((cs) => [...cs, { id: novo.id, name: novo.name, desc: "", idList }]);
    setNovoTitulo("");
    setNovaTarefaEm(null);
  };

  const excluirCard = async (cardId) => {
    setCards((cs) => cs.filter((c) => c.id !== cardId)); // otimista
    await fetch(`https://api.trello.com/1/cards/${cardId}?${q}`, { method: "DELETE" });
  };

  if (erro) return <p className="text-sm" style={{ color: COLORS.wine }}>{erro}</p>;
  if (!listas || !cards) return <p className="flex items-center gap-2 text-sm" style={{ color: COLORS.slate }}><Loader2 size={14} className="animate-spin" /> Carregando quadro do Trello...</p>;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2" style={{ maxWidth: "100%" }}>
      {listas.map((lista) => {
        const doLista = cards.filter((c) => c.idList === lista.id);
        return (
          <div key={lista.id} className="shrink-0 rounded-lg p-2.5" style={{ width: 272, background: TRELLO_BG }}>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-sm font-semibold break-words" style={{ color: "#1D2125", minWidth: 0 }}>{lista.name}</p>
              <span className="text-xs shrink-0 ml-2" style={{ color: "#5E6C84" }}>{doLista.length}</span>
            </div>
            <div
              className="flex flex-col gap-2 min-h-[40px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const id = e.dataTransfer.getData("text/plain"); if (id) moverCard(id, lista.id); }}
            >
              {doLista.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                  className="p-2.5 rounded-md text-sm cursor-grab active:cursor-grabbing group"
                  style={{ background: "#fff", boxShadow: "0 1px 2px rgba(9,30,66,0.25)", minWidth: 0, overflowWrap: "anywhere" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p style={{ color: "#1D2125", minWidth: 0, overflowWrap: "anywhere" }}>{c.name}</p>
                    <button onClick={() => excluirCard(c.id)} aria-label="Excluir card" className="p-0.5 rounded hover:opacity-70 shrink-0" style={{ color: COLORS.wine }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {c.desc && <p className="text-xs mt-1" style={{ ...clampStyle, color: "#5E6C84", overflowWrap: "anywhere" }}>{c.desc}</p>}
                </div>
              ))}
            </div>
            {novaTarefaEm === lista.id ? (
              <form onSubmit={(e) => { e.preventDefault(); criarCard(lista.id); }} className="flex flex-col gap-1.5 mt-2">
                <input autoFocus value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} placeholder="Título..." className="px-2 py-1.5 rounded text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, background: "#fff" }} />
                <div className="flex items-center gap-2">
                  <button type="submit" className="px-2 py-1 rounded text-xs font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>Adicionar</button>
                  <button type="button" onClick={() => { setNovaTarefaEm(null); setNovoTitulo(""); }} className="text-xs" style={{ color: "#5E6C84" }}>Cancelar</button>
                </div>
              </form>
            ) : (
              <button onClick={() => setNovaTarefaEm(lista.id)} className="flex items-center gap-1 mt-2 px-1 py-1 rounded text-xs hover:bg-black/5" style={{ color: "#44546F" }}>
                <Plus size={12} /> Adicionar cartão
              </button>
            )}
          </div>
        );
      })}
      {listas.length === 0 && <p className="text-sm" style={{ color: COLORS.slate }}>Esse quadro não tem nenhuma lista.</p>}
    </div>
  );
}
