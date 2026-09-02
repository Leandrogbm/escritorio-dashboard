import React, { useMemo } from "react";
import { Sunrise, Clock, Bell, ListChecks, AlertTriangle } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import Stamp, { urgencia } from "../Stamp.jsx";
import { COLORS } from "../../lib/theme.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
import { supabase } from "../../lib/supabaseClient.js";

const diasAte = (data) => Math.ceil((new Date(`${data}T00:00:00`) - new Date(new Date().toDateString())) / 86400000);
const JANELA_DIAS = 10; // "vencendo" = já vencido (dias < 0) ou vence nos próximos 10 dias — mesma janela de urgência de Stamp.jsx (>10 dias = "Em dia", não precisa aparecer aqui)

// Painel "Hoje": agrega prazos vencendo + notificações não lidas + tarefas pendentes numa
// tela só, pra não precisar abrir 3 abas pra saber "o que preciso fazer agora". Só leitura +
// ações rápidas (marcar notificação como lida) — edição de verdade continua nas abas de
// origem (Prazos/Quadro), clicar num item aqui só navega até lá.
//
// Escopo por cargo: mesma regra já usada em processos_sel/QuadroTab — advogado vê só o que é
// dele (responsavel_id na própria linha de prazos/tarefas; em notificacoes, que não tem
// responsavel_id, usa o conjunto de processos que o advogado já enxerga via RLS de
// `processos` como equivalente). Sócio/admin (e qualquer outro cargo com o módulo liberado)
// veem tudo da organização — só advogado é restrito, igual ao resto do sistema.
export default function HojeTab({ orgId, currentRole, profile, onAbrirProcesso }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const meuId = profile?.id;
  const vejaTudo = currentRole !== "advogado";

  const { data: prazosRaw } = useSupabaseTable("prazos", {
    select: "*, processo:processos(id,numero,cliente:clientes(nome))", eq: orgEq,
  });
  const { data: notificacoesRaw, refresh: refreshNotificacoes } = useSupabaseTable("notificacoes", {
    select: "*", orderBy: "created_at", ascending: false, eq: orgEq,
  });
  const { data: tarefasRaw } = useSupabaseTable("tarefas", {
    select: "*, processo:processos(id,numero)", eq: orgEq,
  });
  // Só pra dar a advogado o "equivalente" de responsavel_id em notificacoes (que não tem essa
  // coluna): RLS de `processos` já restringe essa lista aos processos dele, então basta
  // comparar processo_id contra esse conjunto — sem reinventar a regra de visibilidade.
  const { data: meusProcessos } = useSupabaseTable("processos", { select: "id", eq: orgEq });
  const meusProcessosIds = useMemo(() => new Set(meusProcessos.map((p) => p.id)), [meusProcessos]);

  const prazos = useMemo(() => {
    const escopados = vejaTudo ? prazosRaw : prazosRaw.filter((p) => p.responsavel_id === meuId);
    return escopados
      .filter((p) => diasAte(p.data) <= JANELA_DIAS)
      .sort((a, b) => diasAte(a.data) - diasAte(b.data));
  }, [prazosRaw, vejaTudo, meuId]);

  const notificacoes = useMemo(() => {
    const naoLidas = notificacoesRaw.filter((n) => n.tipo !== "pagamento_possivel" && !n.lida);
    return vejaTudo ? naoLidas : naoLidas.filter((n) => meusProcessosIds.has(n.processo_id));
  }, [notificacoesRaw, vejaTudo, meusProcessosIds]);

  const tarefas = useMemo(() => {
    const pendentes = tarefasRaw.filter((t) => t.status !== "Concluída");
    return vejaTudo ? pendentes : pendentes.filter((t) => t.responsavel_id === meuId);
  }, [tarefasRaw, vejaTudo, meuId]);

  const marcarLida = async (n) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", n.id);
    refreshNotificacoes();
    if (n.processo_id) onAbrirProcesso?.(n.processo_id);
  };

  return (
    <div>
      <SectionTitle
        icon={Sunrise}
        title="Hoje"
        subtitle={vejaTudo ? "O que precisa da sua atenção na organização" : "O que precisa da sua atenção"}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="!p-0 overflow-hidden">
          <CardHeader icon={Clock} label="Prazos vencendo" count={prazos.length} />
          {prazos.length === 0 && <VazioMsg>Nenhum prazo vencendo nos próximos {JANELA_DIAS} dias.</VazioMsg>}
          {prazos.map((p) => {
            const dias = diasAte(p.data);
            const u = urgencia(dias);
            return (
              <button
                key={p.id}
                onClick={() => onAbrirProcesso?.(p.processo?.id)}
                className="w-full text-left flex items-center justify-between gap-3 px-4 py-3"
                style={{ borderTop: `1px solid ${COLORS.line}` }}
              >
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: COLORS.ink, fontWeight: 600 }}>{p.tipo}</p>
                  <p className="text-xs truncate" style={{ color: COLORS.slate }}>{p.processo?.numero ?? "—"} · {p.processo?.cliente?.nome ?? "—"}</p>
                </div>
                <Stamp tone={u.tone}>{u.label} · {dias}d</Stamp>
              </button>
            );
          })}
        </Card>

        <Card className="!p-0 overflow-hidden">
          <CardHeader icon={Bell} label="Notificações" count={notificacoes.length} />
          {notificacoes.length === 0 && <VazioMsg>Nenhuma notificação não lida.</VazioMsg>}
          {notificacoes.map((n) => (
            <button
              key={n.id}
              onClick={() => marcarLida(n)}
              className="w-full text-left flex items-start gap-2 px-4 py-3"
              style={{ borderTop: `1px solid ${COLORS.line}` }}
            >
              {n.requer_atencao && <AlertTriangle size={14} color={COLORS.wine} className="mt-0.5 shrink-0" />}
              <div className="min-w-0">
                <p className="text-sm truncate" style={{ color: COLORS.ink, fontWeight: 600 }}>{n.titulo}</p>
                {n.texto && <p className="text-xs truncate" style={{ color: COLORS.slate }}>{n.texto}</p>}
              </div>
            </button>
          ))}
        </Card>

        <Card className="!p-0 overflow-hidden">
          <CardHeader icon={ListChecks} label="Tarefas" count={tarefas.length} />
          {tarefas.length === 0 && <VazioMsg>Nenhuma tarefa pendente.</VazioMsg>}
          {tarefas.map((t) => (
            <button
              key={t.id}
              onClick={() => onAbrirProcesso?.(t.processo?.id)}
              className="w-full text-left flex items-center justify-between gap-3 px-4 py-3"
              style={{ borderTop: `1px solid ${COLORS.line}` }}
            >
              <div className="min-w-0">
                <p className="text-sm truncate" style={{ color: COLORS.ink, fontWeight: 600 }}>{t.titulo}</p>
                <p className="text-xs truncate" style={{ color: COLORS.slate }}>{t.processo?.numero ?? "—"} · {t.status}</p>
              </div>
            </button>
          ))}
        </Card>
      </div>
    </div>
  );
}

function CardHeader({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
      <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.ink }}>
        <Icon size={15} color={COLORS.slate} /> {label}
      </p>
      <span className="text-xs font-semibold" style={{ color: COLORS.slate }}>{count}</span>
    </div>
  );
}

function VazioMsg({ children }) {
  return <p className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>{children}</p>;
}
