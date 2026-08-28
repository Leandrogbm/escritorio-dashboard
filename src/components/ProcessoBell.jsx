import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { supabase } from "../lib/supabaseClient.js";
import { useEscClose } from "../hooks/useEscClose.js";

// Sino individual por processo — mesma tabela `notificacoes` do sino geral (NotificacoesBell),
// só filtrada por processo_id. Não faz fetch próprio: recebe as notificações desse processo
// já filtradas pelo pai (ProcessosTab busca todas 1x e reparte por processo_id), pra não
// disparar 1 query por card.
//
// Portal + position:fixed calculado pela posição real do botão (igual StatusPicker.jsx) —
// o sino costuma ficar perto da borda direita do card, e um dropdown `position:absolute`
// simples ou sai cortado da tela ou nasce grudado no canto errado.
export default function ProcessoBell({ notificacoes, onMudou }) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState(null);
  const botaoRef = useRef(null);
  useEscClose(() => setAberto(false), aberto);
  const naoLidas = notificacoes.filter((n) => !n.lida);

  useLayoutEffect(() => {
    if (!aberto || !botaoRef.current) return;
    const LARGURA = 300;
    const calcular = () => {
      const r = botaoRef.current.getBoundingClientRect();
      const alturaEstimada = Math.min(320, notificacoes.length * 56 + 8);
      const espacoEmbaixo = window.innerHeight - r.bottom;
      const abrirPraCima = espacoEmbaixo < alturaEstimada && r.top > alturaEstimada;
      setPos({
        left: Math.max(8, Math.min(r.left, window.innerWidth - LARGURA - 8)),
        top: abrirPraCima ? r.top - alturaEstimada - 4 : r.bottom + 4,
      });
    };
    calcular();
    window.addEventListener("scroll", calcular, true);
    window.addEventListener("resize", calcular);
    return () => {
      window.removeEventListener("scroll", calcular, true);
      window.removeEventListener("resize", calcular);
    };
  }, [aberto, notificacoes.length]);

  const marcarLida = async (id) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    onMudou();
  };

  const marcarTodasLidas = async () => {
    const ids = naoLidas.map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notificacoes").update({ lida: true }).in("id", ids);
    onMudou();
  };

  if (notificacoes.length === 0) return null;

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button ref={botaoRef} onClick={() => setAberto((v) => !v)} aria-label="Notificações do processo" className="relative p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}>
        <Bell size={14} />
        {naoLidas.length > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[9px] font-semibold"
            style={{ width: 13, height: 13, background: COLORS.wine, color: "#fff" }}
          >
            {naoLidas.length > 9 ? "9+" : naoLidas.length}
          </span>
        )}
      </button>

      {aberto && pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="fixed z-50 rounded-lg overflow-hidden" style={{ top: pos.top, left: pos.left, width: 300, maxHeight: 320, background: "#fff", border: `1px solid ${COLORS.line}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
            <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
              <p className="text-xs font-semibold" style={{ color: COLORS.ink }}>Notificações</p>
              {naoLidas.length > 0 && (
                <button onClick={marcarTodasLidas} className="flex items-center gap-1 text-xs underline" style={{ color: COLORS.brassText }}>
                  <CheckCheck size={12} /> Marcar todas como lidas
                </button>
              )}
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
              {notificacoes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => marcarLida(n.id)}
                  className="w-full text-left px-3 py-2.5"
                  style={{ borderBottom: `1px solid ${COLORS.line}`, background: n.lida ? "transparent" : "rgba(165,121,59,0.06)" }}
                >
                  <p className="text-xs" style={{ color: COLORS.ink, fontWeight: n.lida ? 400 : 600 }}>{n.titulo}</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.slate }}>{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
