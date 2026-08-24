import React, { useState } from "react";
import { Bell } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { supabase } from "../lib/supabaseClient.js";

// Sino individual por processo — mesma tabela `notificacoes` do sino geral (NotificacoesBell),
// só filtrada por processo_id. Não faz fetch próprio: recebe as notificações desse processo
// já filtradas pelo pai (ProcessosTab busca todas 1x e reparte por processo_id), pra não
// disparar 1 query por card.
export default function ProcessoBell({ notificacoes, onMudou }) {
  const [aberto, setAberto] = useState(false);
  const naoLidas = notificacoes.filter((n) => !n.lida);

  const marcarLida = async (id) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    onMudou();
  };

  if (notificacoes.length === 0) return null;

  return (
    <div className="relative">
      <button onClick={() => setAberto((v) => !v)} aria-label="Notificações do processo" className="relative p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}>
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

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute left-0 mt-2 z-50 rounded-lg overflow-hidden" style={{ width: 300, maxHeight: 320, background: "#fff", border: `1px solid ${COLORS.line}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
            <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
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
        </>
      )}
    </div>
  );
}
