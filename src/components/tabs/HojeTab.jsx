import React, { useMemo, useState } from "react";
import { Sunrise, Clock, Bell, ListChecks, AlertTriangle, CheckCircle2, BellOff, ChevronDown, ChevronUp, CheckCheck } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import Stamp, { urgencia, diasAte } from "../Stamp.jsx";
import { COLORS } from "../../lib/theme.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
import { supabase } from "../../lib/supabaseClient.js";

const JANELA_DIAS = 10; // "vencendo" = já vencido ou vence nos próximos 10 dias — mesma janela de urgência de Stamp.jsx (>10 dias = "Em dia", não precisa aparecer aqui)
// Piso pro lado "já vencido": prazos.status não existe (só sai da tabela por exclusão manual
// — ver schema.sql), então sem um piso um prazo esquecido há 1 ano ficaria "Urgente · -365d"
// pra sempre, nunca sumindo do topo da tela. ponytail: fix honesto seria um status de
// resolvido em `prazos`; até lá, esconde daqui o que já passou de 30 dias — ainda aparece
// na aba Prazos (essa tela é só o "que precisa de atenção AGORA", não o histórico).
const PISO_DIAS_VENCIDO = -30;

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

  const { data: prazosRaw, error: erroPrazos } = useSupabaseTable("prazos", {
    select: "*, processo:processos(id,numero,cliente:clientes(nome))", eq: orgEq,
  });
  const { data: notificacoesRaw, error: erroNotificacoes, refresh: refreshNotificacoes } = useSupabaseTable("notificacoes", {
    select: "*", orderBy: "created_at", ascending: false, eq: orgEq,
  });
  const { data: tarefasRaw, error: erroTarefas } = useSupabaseTable("tarefas", {
    select: "*, processo:processos(id,numero)", eq: orgEq,
  });
  // Só pra dar a advogado o "equivalente" de responsavel_id em notificacoes (que não tem essa
  // coluna): RLS de `processos` já restringe essa lista aos processos dele, então basta
  // comparar processo_id contra esse conjunto — sem reinventar a regra de visibilidade.
  const { data: meusProcessos, error: erroMeusProcessos } = useSupabaseTable("processos", { select: "id", eq: orgEq });
  const meusProcessosIds = useMemo(() => new Set(meusProcessos.map((p) => p.id)), [meusProcessos]);

  const prazos = useMemo(() => {
    const escopados = vejaTudo ? prazosRaw : prazosRaw.filter((p) => p.responsavel_id === meuId);
    return escopados
      .filter((p) => { const d = diasAte(p.data); return d >= PISO_DIAS_VENCIDO && d <= JANELA_DIAS; })
      .sort((a, b) => diasAte(a.data) - diasAte(b.data));
  }, [prazosRaw, vejaTudo, meuId]);

  const notificacoes = useMemo(() => {
    const naoLidas = notificacoesRaw.filter((n) => n.tipo !== "pagamento_possivel" && !n.lida);
    // processo_id null (notificação sem processo vinculado) não tem "dono" nenhum pra
    // restringir -- Set.has(null) sempre false escondia ela de todo advogado sem motivo
    // (achado real do qa-guardian).
    return vejaTudo ? naoLidas : naoLidas.filter((n) => n.processo_id == null || meusProcessosIds.has(n.processo_id));
  }, [notificacoesRaw, vejaTudo, meusProcessosIds]);

  const tarefas = useMemo(() => {
    const pendentes = tarefasRaw.filter((t) => t.status !== "Concluída");
    return vejaTudo ? pendentes : pendentes.filter((t) => t.responsavel_id === meuId);
  }, [tarefasRaw, vejaTudo, meuId]);

  const [verNotificacoes, setVerNotificacoes] = useState(false);
  const [marcandoTudo, setMarcandoTudo] = useState(false);

  const marcarLida = async (n) => {
    const { error } = await supabase.from("notificacoes").update({ lida: true }).eq("id", n.id);
    if (error) { alert(`Não deu pra marcar como lida: ${error.message}`); return; }
    refreshNotificacoes();
    if (n.processo_id) onAbrirProcesso?.(n.processo_id);
  };

  // Notificação aqui é quase sempre movimentação passada de processo (sync do DataJud), não
  // algo "de hoje" — com centenas acumuladas isso inundava o painel inteiro (achado do
  // próprio usuário). Fica colapsada por padrão; "marcar tudo lido" some com a fila de uma vez
  // sem precisar abrir uma por uma.
  const marcarTodasLidas = async () => {
    if (notificacoes.length === 0) return;
    setMarcandoTudo(true);
    const { error } = await supabase.from("notificacoes").update({ lida: true }).in("id", notificacoes.map((n) => n.id));
    setMarcandoTudo(false);
    if (error) { alert(`Não deu pra marcar tudo como lido: ${error.message}`); return; }
    refreshNotificacoes();
  };

  // Prazo "urgente" (tone === "urgent", <=3 dias) é o único jeito real de perder um caso —
  // quando existe algum, o card de Prazos sai da grade de 3 colunas de peso igual e vira uma
  // faixa cheia acima das outras duas: a tela se rearranja em volta do que pode doer, em vez
  // de um badge a mais que qualquer um aprende a ignorar.
  const prazosComUrgencia = useMemo(
    () => prazos.map((p) => { const dias = diasAte(p.data); return { ...p, dias, u: urgencia(dias) }; }),
    [prazos]
  );
  const qtdUrgente = prazosComUrgencia.filter((p) => p.u.tone === "urgent").length;
  const emAlerta = qtdUrgente > 0;

  const listaPrazos = (
    <>
      {erroPrazos && <ErroMsg>{erroPrazos}</ErroMsg>}
      {!erroPrazos && prazos.length === 0 && (
        <EmptyCard icon={CheckCircle2} tone="success" title="Nenhum prazo apertando" subtitle={`Nada vencendo nos próximos ${JANELA_DIAS} dias.`} />
      )}
      {prazosComUrgencia.map((p) => (
        <button
          key={p.id}
          onClick={() => onAbrirProcesso?.(p.processo?.id)}
          className="w-full text-left flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-black/[0.02]"
          style={{ borderTop: `1px solid ${COLORS.line}` }}
        >
          <div className="min-w-0">
            <p className="text-sm truncate" style={{ color: COLORS.ink, fontWeight: 600 }}>{p.tipo}</p>
            <p className="text-xs" style={{ color: COLORS.slate }}>{p.processo?.numero ?? "—"} · {p.processo?.cliente?.nome ?? "—"}</p>
          </div>
          <Stamp tone={p.u.tone}>{p.dias < 0 ? `Venceu · ${-p.dias}d` : p.dias === 0 ? "Vence hoje" : `${p.u.label} · ${p.dias}d`}</Stamp>
        </button>
      ))}
    </>
  );

  return (
    <div>
      <SectionTitle
        icon={Sunrise}
        title="Hoje"
        subtitle={vejaTudo ? "O que precisa da sua atenção na organização" : "O que precisa da sua atenção"}
      />

      {emAlerta && (
        <Card className="!p-0 overflow-hidden mb-4" style={{ borderColor: COLORS.wine }}>
          <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid #F1D7D8", background: "rgba(193,39,45,0.05)" }}>
            <p className="flex items-center gap-2 text-sm font-bold" style={{ color: COLORS.wine }}>
              <Clock size={16} color={COLORS.wine} /> Prazos vencendo
            </p>
            <Stamp tone="urgent">{qtdUrgente} {qtdUrgente === 1 ? "urgente" : "urgentes"}</Stamp>
          </div>
          {listaPrazos}
        </Card>
      )}

      <div className={`grid grid-cols-1 gap-4 ${emAlerta ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
        {!emAlerta && (
          <Card className="!p-0 overflow-hidden">
            <CardHeader icon={Clock} label="Prazos vencendo" count={prazos.length} />
            {listaPrazos}
          </Card>
        )}

        <Card className="!p-0 overflow-hidden">
          <CardHeader icon={Bell} label="Notificações" count={notificacoes.length} />
          {(erroNotificacoes || erroMeusProcessos) && <ErroMsg>{erroNotificacoes || erroMeusProcessos}</ErroMsg>}
          {!erroNotificacoes && !erroMeusProcessos && notificacoes.length === 0 && (
            <EmptyCard icon={BellOff} tone="neutral" title="Tudo lido" subtitle="Nenhuma notificação nova por aqui." />
          )}
          {!erroNotificacoes && !erroMeusProcessos && notificacoes.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ borderTop: `1px solid ${COLORS.line}` }}>
                <button
                  onClick={() => setVerNotificacoes((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: COLORS.slate }}
                >
                  {verNotificacoes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {verNotificacoes ? "Ocultar lista" : "Ver lista"}
                </button>
                <button
                  onClick={marcarTodasLidas}
                  disabled={marcandoTudo}
                  className="flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: COLORS.ink, opacity: marcandoTudo ? 0.6 : 1 }}
                >
                  <CheckCheck size={14} /> {marcandoTudo ? "Marcando..." : "Marcar tudo como lido"}
                </button>
              </div>
              {!verNotificacoes && (
                <p className="px-4 pb-3 text-xs" style={{ color: COLORS.slate }}>
                  Na maioria são movimentações passadas de processo (sync automático), não coisa de hoje.
                </p>
              )}
            </>
          )}
          {verNotificacoes && notificacoes.map((n) => (
            <button
              key={n.id}
              onClick={() => marcarLida(n)}
              className="w-full text-left flex items-start gap-2 px-4 py-3 hover:bg-black/[0.02]"
              style={{ borderTop: `1px solid ${COLORS.line}` }}
            >
              {n.requer_atencao && <AlertTriangle size={14} color={COLORS.wine} className="mt-0.5 shrink-0" />}
              <div className="min-w-0">
                <p className="text-sm truncate" style={{ color: COLORS.ink, fontWeight: 600 }}>{n.titulo}</p>
                {n.texto && <p className="text-xs mt-0.5" style={{ color: COLORS.slate }}>{n.texto}</p>}
              </div>
            </button>
          ))}
        </Card>

        <Card className="!p-0 overflow-hidden">
          <CardHeader icon={ListChecks} label="Tarefas" count={tarefas.length} />
          {erroTarefas && <ErroMsg>{erroTarefas}</ErroMsg>}
          {!erroTarefas && tarefas.length === 0 && (
            <EmptyCard icon={CheckCircle2} tone="success" title="Fila zerada" subtitle="Nenhuma tarefa pendente." />
          )}
          {tarefas.map((t) => (
            <button
              key={t.id}
              onClick={() => onAbrirProcesso?.(t.processo?.id)}
              className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 hover:bg-black/[0.02]"
              style={{ borderTop: `1px solid ${COLORS.line}` }}
            >
              <div className="min-w-0">
                <p className="text-sm truncate" style={{ color: COLORS.ink, fontWeight: 600 }}>{t.titulo}</p>
                <p className="text-xs mt-0.5" style={{ color: COLORS.slate }}>{t.processo?.numero ?? "—"} · {t.status}</p>
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

// Estado vazio por seção — troca o texto cinza genérico por um selo colorido + frase curta e
// positiva. `tone` reaproveita a paleta de Stamp (success/neutral) em vez de inventar cor
// nova: bandeja zerada é boa notícia, não formulário sem dado.
const EMPTY_TONE = {
  success: { fg: COLORS.success, bg: "rgba(30,132,73,0.10)" },
  neutral: { fg: COLORS.slate, bg: "rgba(91,100,114,0.08)" },
};

function EmptyCard({ icon: Icon, tone = "neutral", title, subtitle }) {
  const t = EMPTY_TONE[tone] ?? EMPTY_TONE.neutral;
  return (
    <div className="flex flex-col items-center text-center px-6 py-10">
      <div className="flex items-center justify-center rounded-full p-3 mb-3" style={{ background: t.bg }}>
        <Icon size={22} color={t.fg} />
      </div>
      <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{title}</p>
      <p className="text-xs mt-1 max-w-[220px]" style={{ color: COLORS.slate }}>{subtitle}</p>
    </div>
  );
}

// Erro real de carregamento não pode virar "lista vazia" — já foi bug real nesse projeto
// (ver bce4e1d) e essa é a tela cuja função inteira é dizer "tem algo pegando fogo ou não".
function ErroMsg({ children }) {
  return (
    <p className="px-4 py-6 text-center text-sm" style={{ color: COLORS.wine }}>
      Não deu pra carregar ({children}). Atualize a página; se persistir, saia e entre de novo.
    </p>
  );
}
