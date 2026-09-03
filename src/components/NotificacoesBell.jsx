import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, AlertTriangle } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { useEscClose } from "../hooks/useEscClose.js";
import { supabase } from "../lib/supabaseClient.js";

const LARGURA = 360;

// Painel de notificações (movimentação nova do DataJud + alerta de prazo vencendo). Possível
// pagamento (extrato) NÃO aparece aqui — é específico do Financeiro e tem ação própria
// (confirmar/rejeitar), por isso vive no sino por cliente (ClienteBell.jsx), não neste geral.
// Sem polling em tempo real por ora — recarrega ao abrir o sino, suficiente pra um
// escritório pequeno checar algumas vezes por dia (real-time fica pra depois, se pedirem).
//
// Portal + position:fixed calculado pela posição real do botão (igual ProcessoBell.jsx/
// StatusPicker.jsx) — o sino fica perto da borda direita do TopBar mas não colado nela (tem
// "Sair" depois), então um dropdown `absolute right-0` simples vazava pra fora da tela em
// mobile (achado real de auditoria: painel cortado/ilegível em 320-375px).
export default function NotificacoesBell({ orgId, onAbrirProcesso }) {
  // eq por org_id é OBRIGATÓRIO aqui, mesmo a RLS já filtrando: notificacoes_sel tem uma
  // cláusula "or is_platform_admin()" sem checagem de organização nenhuma (é o suporte
  // enxergando geral de propósito) — sem esse filtro explícito, uma conta de platform admin
  // logada numa empresa normal via esse sino via notificação de TODAS as organizações
  // misturadas (achado real em produção: notificação da org de demonstração aparecendo pro
  // cliente pagante). Mesmo padrão que toda outra tela já usa (ver ProcessosTab.jsx).
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: todas, refresh } = useSupabaseTable("notificacoes", {
    select: "*, processo:processos(id,numero,cliente:clientes(nome))", orderBy: "created_at", ascending: false, eq: orgEq,
  });
  const notificacoes = todas.filter((n) => n.tipo !== "pagamento_possivel");
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState(null);
  const botaoRef = useRef(null);
  useEscClose(() => setAberto(false), aberto);

  const naoLidas = notificacoes.filter((n) => !n.lida);

  const abrir = () => { setAberto((v) => !v); if (!aberto) refresh(); };

  useLayoutEffect(() => {
    if (!aberto || !botaoRef.current) return;
    const calcular = () => {
      const r = botaoRef.current.getBoundingClientRect();
      const alturaEstimada = Math.min(420, 60 + notificacoes.length * 70);
      const espacoEmbaixo = window.innerHeight - r.bottom;
      const abrirPraCima = espacoEmbaixo < alturaEstimada && r.top > alturaEstimada;
      setPos({
        left: Math.max(8, Math.min(r.right - LARGURA, window.innerWidth - LARGURA - 8)),
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

  const abrirNotificacao = async (n) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", n.id);
    refresh();
    if (n.processo?.id) {
      setAberto(false);
      onAbrirProcesso?.(n.processo.id);
    }
  };

  const marcarTodasLidas = async () => {
    const ids = naoLidas.map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notificacoes").update({ lida: true }).in("id", ids);
    refresh();
  };

  return (
    <div className="relative">
      <button ref={botaoRef} onClick={abrir} aria-label="Notificações" className="relative p-2 rounded-md hover:opacity-70" style={{ color: COLORS.slate }}>
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

      {aberto && pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="fixed z-50 rounded-lg overflow-hidden" style={{ top: pos.top, left: pos.left, width: `min(${LARGURA}px, calc(100vw - 16px))`, maxHeight: 420, background: "#fff", border: `1px solid ${COLORS.line}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
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
                  onClick={() => abrirNotificacao(n)}
                  className="w-full text-left px-4 py-3 flex items-start gap-2 hover:bg-black/[0.02]"
                  style={{ borderBottom: `1px solid ${COLORS.line}`, background: n.lida ? "transparent" : "rgba(165,121,59,0.06)" }}
                >
                  {n.requer_atencao && <AlertTriangle size={14} color={COLORS.wine} className="mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm" style={{ color: COLORS.ink, fontWeight: n.lida ? 400 : 600 }}>{n.titulo}</p>
                    {n.texto && <p className="text-xs mt-0.5" style={{ color: COLORS.slate }}>{n.texto}</p>}
                    {n.processo && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: COLORS.slate }}>
                        {n.processo.numero} · {n.processo.cliente?.nome ?? "—"}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: COLORS.slate }}>{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                  </div>
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
