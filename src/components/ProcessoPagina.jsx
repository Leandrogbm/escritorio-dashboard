import React, { useState } from "react";
import { ArrowLeft, AlertTriangle, FileClock, ListTodo, Landmark, FileText, Pencil, Trash2, Archive, ArchiveRestore } from "lucide-react";
import Card from "./Card.jsx";
import StatusPicker from "./StatusPicker.jsx";
import MovimentacoesPanel from "./MovimentacoesPanel.jsx";
import TarefasPanel from "./TarefasPanel.jsx";
import DepositosPanel from "./DepositosPanel.jsx";
import DocumentosPanel from "./DocumentosPanel.jsx";
import { COLORS } from "../lib/theme.js";
import { useEscClose } from "../hooks/useEscClose.js";
import { confirmarExclusao } from "../lib/confirmarExclusao.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";

const STATUS_TONE = { "Em andamento": "ok", "Aguardando decisão": "warn", "Suspenso": "neutral", "Encerrado": "neutral" };

// Página cheia do processo (substitui a lista dentro da própria aba Processos, não é popup)
// — clicar num processo troca o conteúdo da tela, com botão "Voltar", em vez de empilhar
// modal em cima de modal (era confuso: Esc fechava um de cada vez, fora de ordem).
export default function ProcessoPagina({ processo: p, responsaveis, atrasos, equipe, orgId, profile, onVoltar, onEditar, onExcluir, onRegistrarPrazo, onMudarStatus, onArquivar }) {
  useEscClose(onVoltar, true);
  const [aba, setAba] = useState("andamentos");
  const { data: prazos } = useSupabaseTable("prazos", { select: "id, feito", eq: ["processo_id", p.id] });

  // Mesma regra do arquivo de cliente, no escopo do processo: encerrado e sem prazo em aberto.
  // Processo de cliente arquivado já está no Arquivo pelo cliente — desarquiva por lá.
  const pendencias = [
    p.status !== "Encerrado" && "processo não encerrado",
    prazos.some((x) => !x.feito) && "prazo em aberto",
  ].filter(Boolean);
  const alternarArquivo = () => {
    if (p.arquivado) return onArquivar(false);
    if (pendencias.length) return alert(`Não dá pra arquivar ainda: ${pendencias.join(", ")}.`);
    if (confirm("Arquivar este processo? Ele sai da lista e fica no Arquivo.")) onArquivar(true);
  };

  const abas = [
    { key: "andamentos", label: "Andamentos", icon: FileClock, alerta: p.datajud_status === "erro" },
    { key: "tarefas", label: "Tarefas", icon: ListTodo },
    { key: "depositos", label: "Depósitos judiciais", icon: Landmark },
    { key: "documentos", label: "Documentos", icon: FileText },
  ];

  return (
    <div>
      <button onClick={onVoltar} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: COLORS.slate }}>
        <ArrowLeft size={15} /> Voltar pra Processos
      </button>

      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.slate }}>{p.numero}</p>
          <p className="mt-1 text-2xl" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.ink }}>{p.cliente?.nome ?? "—"}</p>
        </div>
        <StatusPicker value={p.status} options={Object.keys(STATUS_TONE)} tone={STATUS_TONE} onChange={onMudarStatus} />
      </div>

      {atrasos > 0 && (
        <div className="flex items-center gap-1.5 mb-4 px-3 py-2 rounded-md text-xs" style={{ background: "rgba(155,28,28,0.08)", color: COLORS.wine }}>
          <AlertTriangle size={13} />
          Cliente com {atrasos} honorário{atrasos > 1 ? "s" : ""} em atraso
        </div>
      )}

      <Card className="mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Área</p>
            <p className="mt-0.5" style={{ color: COLORS.ink, fontWeight: 600 }}>{p.area}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Responsáveis</p>
            <p className="mt-0.5" style={{ color: COLORS.ink, fontWeight: 600 }}>
              {[...(responsaveis ?? []).map((r) => r.nome), ...(p.responsavel_socios ? ["Sócios"] : [])].join(", ") || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Valor da causa</p>
            <p className="mt-0.5" style={{ color: COLORS.ink, fontWeight: 600 }}>{p.valor ? p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Última verificação</p>
            <p className="mt-0.5" style={{ color: COLORS.ink, fontWeight: 600 }}>{p.ultima_verificacao_datajud ? new Date(p.ultima_verificacao_datajud).toLocaleDateString("pt-BR") : "—"}</p>
          </div>
        </div>
        {p.observacao && (
          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${COLORS.line}` }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Observação</p>
            <p className="mt-1 text-sm whitespace-pre-wrap" style={{ color: COLORS.ink }}>{p.observacao}</p>
          </div>
        )}
        <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: `1px solid ${COLORS.line}` }}>
          <button onClick={onEditar} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
            <Pencil size={14} /> Editar
          </button>
          {onArquivar && !p.cliente?.arquivado && (
            <button
              onClick={alternarArquivo}
              title={!p.arquivado && pendencias.length ? `Pendente: ${pendencias.join(", ")}` : undefined}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold"
              style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, opacity: !p.arquivado && pendencias.length ? 0.5 : 1 }}
            >
              {p.arquivado ? <ArchiveRestore size={14} /> : <Archive size={14} />} {p.arquivado ? "Desarquivar" : "Arquivar"}
            </button>
          )}
          <button onClick={() => confirmarExclusao("o número do processo", p.numero, onExcluir)} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.wine }}>
            <Trash2 size={14} /> Excluir
          </button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 mb-5">
        {abas.map((a) => {
          const ativo = aba === a.key;
          return (
            <button
              key={a.key}
              onClick={() => setAba(a.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold"
              style={{ background: ativo ? COLORS.ink : "transparent", color: ativo ? "#fff" : COLORS.ink, border: `1px solid ${ativo ? COLORS.ink : COLORS.line}` }}
            >
              <a.icon size={14} /> {a.label}
              {a.alerta && <AlertTriangle size={12} color={ativo ? "#fff" : COLORS.wine} />}
            </button>
          );
        })}
      </div>

      <Card>
        {aba === "andamentos" && <MovimentacoesPanel processo={p} onRegistrarPrazo={onRegistrarPrazo} embutido />}
        {aba === "tarefas" && <TarefasPanel processo={p} equipe={equipe} orgId={orgId} embutido />}
        {aba === "depositos" && <DepositosPanel processo={p} orgId={orgId} embutido />}
        {aba === "documentos" && <DocumentosPanel processo={p} orgId={orgId} profile={profile} embutido />}
      </Card>
    </div>
  );
}
