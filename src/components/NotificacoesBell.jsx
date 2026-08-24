import React, { useState } from "react";
import { Bell, AlertTriangle } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { supabase } from "../lib/supabaseClient.js";

// Painel de notificações (movimentação nova do DataJud + alerta de prazo vencendo). Possível
// pagamento (extrato) NÃO aparece aqui — é específico do Financeiro e tem ação própria
// (confirmar/rejeitar), por isso vive no sino por cliente (ClienteBell.jsx), não neste geral.
// Sem polling em tempo real por ora — recarrega ao abrir o sino, suficiente pra um
// escritório pequeno checar algumas vezes por dia (real-time fica pra depois, se pedirem).
export default function NotificacoesBell() {
  const { data: todas, refresh } = useSupabaseTable("notificacoes", { select: "*", orderBy: "created_at", ascending: false });
  const notificacoes = todas.filter((n) => n.tipo !== "pagamento_possivel");
  const [aberto, setAberto] = useState(false);

  const naoLidas = notificacoes.filter((n) => !n.lida);

  const abrir = () => { setAberto((v) => !v); if (!aberto) refresh(); };

  const marcarLida = async (id) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    refresh();
  };

  const marcarTodasLidas = async () => {
    const ids = naoLidas.map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notificacoes").update({ lida: true }).in("id", ids);
    refresh();
  };

  return (
    <div className="relative">
      <button onClick={abrir} aria-label="Notificações" className="relative p-2 rounded-md hover:opacity-70" style={{ color: COLORS.slate }}>
        <Bell size={18} />
        {naoLidas.length > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-[10px] font-semibold"
            style={{ width: 16, height: 16, background: COLORS.wine, color: "#fff" }}
          >
            {naoLidas.length > 9 ? "9+" : naoLidas.length}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 mt-2 z-50 rounded-lg overflow-hidden" style={{ width: 360, maxHeight: 420, background: "#fff", border: `1px solid ${COLORS.line}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
              <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Notificações</p>
              {naoLidas.length > 0 && (
                <button onClick={marcarTodasLidas} className="text-xs underline" style={{ color: COLORS.slate }}>Marcar todas como lidas</button>
              )}
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
              {notificacoes.length === 0 && (
                <p className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>Nenhuma notificação ainda.</p>
              )}
              {notificacoes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => marcarLida(n.id)}
                  className="w-full text-left px-4 py-3 flex items-start gap-2"
                  style={{ borderBottom: `1px solid ${COLORS.line}`, background: n.lida ? "transparent" : "rgba(165,121,59,0.06)" }}
                >
                  {n.requer_atencao && <AlertTriangle size={14} color={COLORS.wine} className="mt-0.5 shrink-0" />}
                  <div>
                    <p className="text-sm" style={{ color: COLORS.ink, fontWeight: n.lida ? 400 : 600 }}>{n.titulo}</p>
                    {n.texto && <p className="text-xs mt-0.5" style={{ color: COLORS.slate }}>{n.texto}</p>}
                    <p className="text-xs mt-1" style={{ color: COLORS.slate }}>{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
