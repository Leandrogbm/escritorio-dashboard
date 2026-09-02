import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, ThumbsUp, ThumbsDown } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { supabase } from "../lib/supabaseClient.js";
import { useEscClose } from "../hooks/useEscClose.js";

// Sino de "possível pagamento" por fornecedor (ERP) — mesmo padrão do ClienteBell
// (Financeiro), só que confirmar marca a DESPESA como paga em vez do honorário.
//
// Portal + position:fixed calculado pela posição real do botão (igual ProcessoBell.jsx/
// StatusPicker.jsx) — dentro de linha de tabela com overflow-x-auto, um dropdown
// `position:absolute` simples ou sai cortado da tela ou nasce grudado no canto errado.
export default function FornecedorBell({ notificacoes, onMudou }) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState(null);
  const botaoRef = useRef(null);
  useEscClose(() => setAberto(false), aberto);

  useLayoutEffect(() => {
    if (!aberto || !botaoRef.current) return;
    const LARGURA = 300;
    const calcular = () => {
      const r = botaoRef.current.getBoundingClientRect();
      const alturaEstimada = Math.min(340, notificacoes.length * 90 + 8);
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

  if (notificacoes.length === 0) return null;

  const confirmar = async (n) => {
    await supabase.from("despesas").update({ status: "Pago" }).eq("id", n.despesa_id);
    await supabase.from("notificacoes").delete().eq("id", n.id);
    onMudou();
  };
  const rejeitar = async (n) => {
    await supabase.from("notificacoes").delete().eq("id", n.id);
    onMudou();
  };

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button ref={botaoRef} onClick={() => setAberto((v) => !v)} aria-label="Possíveis pagamentos" className="relative p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}>
        <Bell size={14} />
        <span
          className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[9px] font-semibold"
          style={{ width: 13, height: 13, background: COLORS.wine, color: "#fff" }}
        >
          {notificacoes.length > 9 ? "9+" : notificacoes.length}
        </span>
      </button>

      {aberto && pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="fixed z-50 rounded-lg overflow-hidden" style={{ top: pos.top, left: pos.left, width: 300, maxHeight: 340, background: "#fff", border: `1px solid ${COLORS.line}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
            <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
              {notificacoes.map((n) => (
                <div key={n.id} className="px-3 py-2.5" style={{ borderBottom: `1px solid ${COLORS.line}`, background: "rgba(165,121,59,0.06)" }}>
                  <p className="text-xs" style={{ color: COLORS.ink, fontWeight: 600 }}>{n.titulo}</p>
                  {n.texto && <p className="text-xs mt-0.5" style={{ color: COLORS.slate }}>{n.texto}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => confirmar(n)} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold" style={{ background: COLORS.success, color: "#fff" }}>
                      <ThumbsUp size={11} /> Confirmar
                    </button>
                    <button onClick={() => rejeitar(n)} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.slate }}>
                      <ThumbsDown size={11} /> Não é isso
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
