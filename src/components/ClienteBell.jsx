import React, { useState } from "react";
import { Bell, ThumbsUp, ThumbsDown } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { supabase } from "../lib/supabaseClient.js";

// Sino de "possível pagamento" por cliente (Financeiro) — igual ao ProcessoBell, mas aqui
// tipo pagamento_possivel tem ação própria (confirmar/rejeitar) em vez de só marcar lida.
// Fica só aqui, não aparece no sino geral (NotificacoesBell filtra esse tipo fora) — é
// específico demais do fluxo financeiro pra misturar com movimentação/prazo.
export default function ClienteBell({ notificacoes, onMudou }) {
  const [aberto, setAberto] = useState(false);
  if (notificacoes.length === 0) return null;

  const confirmar = async (n) => {
    await supabase.from("honorarios").update({ status: "Pago" }).eq("id", n.honorario_id);
    await supabase.from("notificacoes").delete().eq("id", n.id);
    onMudou();
  };
  const rejeitar = async (n) => {
    await supabase.from("notificacoes").delete().eq("id", n.id);
    onMudou();
  };

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setAberto((v) => !v)} aria-label="Possíveis pagamentos" className="relative p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}>
        <Bell size={14} />
        <span
          className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[9px] font-semibold"
          style={{ width: 13, height: 13, background: COLORS.wine, color: "#fff" }}
        >
          {notificacoes.length > 9 ? "9+" : notificacoes.length}
        </span>
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute left-0 mt-2 z-50 rounded-lg overflow-hidden" style={{ width: 300, maxHeight: 340, background: "#fff", border: `1px solid ${COLORS.line}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
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
        </>
      )}
    </div>
  );
}
