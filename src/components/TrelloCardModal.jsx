import React, { useEffect, useState } from "react";
import { X, Clock, MessageSquare, Send, Loader2 } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { useEscClose } from "../hooks/useEscClose.js";
import { supabase } from "../lib/supabaseClient.js";
import { corLabel, corTextoLabel } from "../lib/trelloLabelColor.js";

const TRELLO_BG = "#F1F2F4";

async function chamarProxy(body) {
  const { data, error } = await supabase.functions.invoke("trello-proxy", { body });
  if (error) throw new Error((await error.context?.json?.().catch(() => null))?.error ?? error.message);
  return data;
}

function formatData(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Card aberto de verdade, igual clicar num card no Trello — data de vencimento, etiquetas,
// descrição completa (sem clamp) e os comentários, com campo pra comentar direto daqui.
// Pedido explícito do usuário: "tudo que funciona lá tem que funcionar na plataforma,
// experiência de clicar no card e ver os comentários".
export default function TrelloCardModal({ card, onClose, onMudou }) {
  useEscClose(onClose, true);
  const [comentarios, setComentarios] = useState(null); // null = carregando
  const [erro, setErro] = useState("");
  const [novoComentario, setNovoComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregarComentarios = async () => {
    try {
      const dados = await chamarProxy({ acao: "listar_comentarios", cardId: card.id });
      setComentarios(dados.map((a) => ({ id: a.id, texto: a.data?.text, data: a.date, autor: a.memberCreator?.fullName ?? "Alguém" })));
    } catch (err) {
      setErro(`Não consegui carregar os comentários: "${err.message}".`);
    }
  };

  useEffect(() => { carregarComentarios(); }, [card.id]);

  const enviarComentario = async (e) => {
    e.preventDefault();
    if (!novoComentario.trim()) return;
    setEnviando(true);
    try {
      await chamarProxy({ acao: "comentar", cardId: card.id, texto: novoComentario.trim() });
      setNovoComentario("");
      await carregarComentarios();
      onMudou?.();
    } catch (err) {
      alert(`Não consegui comentar: ${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(9,30,66,0.54)" }} onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg"
        style={{ background: TRELLO_BG }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <p className="text-base font-semibold" style={{ color: "#1D2125" }}>{card.name}</p>
            <button onClick={onClose} aria-label="Fechar" className="p-1 rounded hover:bg-black/5 shrink-0" style={{ color: "#44546F" }}>
              <X size={18} />
            </button>
          </div>

          {card.labels?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {card.labels.map((l) => (
                <span key={l.id} className="px-2 py-1 rounded text-xs font-semibold" style={{ backgroundColor: corLabel(l.color), color: corTextoLabel(l.color) }}>
                  {l.name || "    "}
                </span>
              ))}
            </div>
          )}

          {card.due && (
            <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold px-2 py-1 rounded w-fit" style={{ background: card.dueComplete ? "#61BD4F" : "#fff", color: card.dueComplete ? "#172B4D" : "#44546F", border: card.dueComplete ? "none" : `1px solid ${COLORS.line}` }}>
              <Clock size={12} /> {formatData(card.due)}{card.dueComplete && " · concluído"}
            </div>
          )}

          {card.desc && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#44546F" }}>Descrição</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "#1D2125", overflowWrap: "anywhere" }}>{card.desc}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: "#44546F" }}>
              <MessageSquare size={13} /> Comentários
            </p>

            <form onSubmit={enviarComentario} className="flex flex-col gap-2 mb-3">
              <textarea
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
                placeholder="Escrever um comentário..."
                rows={2}
                className="px-3 py-2 rounded-md text-sm resize-none"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, background: "#fff" }}
              />
              <button
                type="submit"
                disabled={enviando || !novoComentario.trim()}
                className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-md text-xs font-semibold"
                style={{ background: COLORS.ink, color: "#fff", opacity: enviando || !novoComentario.trim() ? 0.6 : 1 }}
              >
                {enviando ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Comentar
              </button>
            </form>

            {erro && <p className="text-xs" style={{ color: COLORS.wine }}>{erro}</p>}
            {comentarios === null && !erro && (
              <p className="flex items-center gap-2 text-xs" style={{ color: "#5E6C84" }}><Loader2 size={12} className="animate-spin" /> Carregando comentários...</p>
            )}
            {comentarios?.length === 0 && <p className="text-xs" style={{ color: "#5E6C84" }}>Nenhum comentário ainda.</p>}
            <div className="flex flex-col gap-2.5">
              {comentarios?.map((c) => (
                <div key={c.id} className="p-2.5 rounded-md" style={{ background: "#fff" }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold" style={{ color: "#1D2125" }}>{c.autor}</p>
                    <p className="text-[11px]" style={{ color: "#5E6C84" }}>{formatData(c.data)}</p>
                  </div>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: "#1D2125", overflowWrap: "anywhere" }}>{c.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
