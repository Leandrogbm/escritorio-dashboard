import React, { useState } from "react";
import { X, AlertTriangle, Clock, Sparkles } from "lucide-react";
import Card from "./Card.jsx";
import { COLORS } from "../lib/theme.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { useEscClose } from "../hooks/useEscClose.js";
import { supabase } from "../lib/supabaseClient.js";

// Andamentos trazidos do DataJud pro processo. Só leitura (vem da fonte oficial) — a ação
// que o advogado tem aqui é registrar um prazo a partir de uma movimentação relevante,
// já que o DataJud não traz o prazo pronto (só avisa que algo aconteceu no processo), e
// pedir um resumo por IA (cacheado em processos.resumo_ia, só reprocessa quando pedido).
export default function MovimentacoesPanel({ processo, onClose, onRegistrarPrazo, embutido = false }) {
  useEscClose(onClose, !embutido);
  const { data: movimentacoes, loading } = useSupabaseTable("movimentacoes_processo", {
    select: "*", orderBy: "data_hora", ascending: false, eq: ["processo_id", processo.id],
  });
  const [resumo, setResumo] = useState(processo.resumo_ia ?? null);
  const [proximoPasso, setProximoPasso] = useState(processo.proximo_passo_ia ?? null);
  const [resumoGeradoEm, setResumoGeradoEm] = useState(processo.resumo_ia_gerado_em ?? null);
  const [resumindo, setResumindo] = useState(false);
  const [erroResumo, setErroResumo] = useState("");

  const resumirComIA = async () => {
    setResumindo(true);
    setErroResumo("");
    const { data, error } = await supabase.functions.invoke("resumir-andamentos", { body: { processoId: processo.id } });
    setResumindo(false);
    if (error) {
      setErroResumo((await error.context?.json?.().catch(() => null))?.error ?? error.message);
      return;
    }
    setResumo(data.resumo);
    setProximoPasso(data.proximoPasso ?? null);
    setResumoGeradoEm(new Date().toISOString());
  };

  const conteudo = (
    <>
        {!embutido && (
          <div className="flex items-center justify-between mb-2">
            <div>
              <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 18, color: COLORS.ink }}>{processo.numero}</p>
              <p className="text-xs" style={{ color: COLORS.slate }}>Andamentos (DataJud)</p>
            </div>
            <button onClick={onClose} className="p-2 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
          </div>
        )}

        <Card className="mb-4" style={{ background: "rgba(165,121,59,0.06)", borderColor: "rgba(165,121,59,0.3)" }}>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: COLORS.ink }}>
              <Sparkles size={13} color={COLORS.brass} /> Resumo por IA
            </p>
            <button onClick={resumirComIA} disabled={resumindo} className="text-xs underline shrink-0" style={{ color: COLORS.brass, opacity: resumindo ? 0.5 : 1 }}>
              {resumindo ? "Gerando..." : resumo ? "Atualizar" : "Gerar resumo"}
            </button>
          </div>
          {resumo ? (
            <>
              <p className="text-sm" style={{ color: COLORS.ink }}>{resumo}</p>
              {proximoPasso && (
                <p className="text-sm mt-2 pt-2" style={{ color: COLORS.ink, borderTop: `1px solid ${COLORS.line}` }}>
                  <span style={{ fontWeight: 600 }}>Próximo passo sugerido: </span>{proximoPasso}
                </p>
              )}
              {resumoGeradoEm && <p className="text-xs mt-1.5" style={{ color: COLORS.slate }}>Gerado em {new Date(resumoGeradoEm).toLocaleString("pt-BR")}</p>}
            </>
          ) : (
            <p className="text-sm" style={{ color: COLORS.slate }}>Nenhum resumo gerado ainda.</p>
          )}
          {erroResumo && <p className="text-xs mt-1.5" style={{ color: COLORS.wine }}>{erroResumo}</p>}
        </Card>

        {processo.ultima_verificacao_datajud && (
          <p className="text-xs mb-4" style={{ color: COLORS.slate }}>
            Última verificação: {new Date(processo.ultima_verificacao_datajud).toLocaleString("pt-BR")}
            {processo.datajud_status === "erro" && <span style={{ color: COLORS.wine }}> — falhou: {processo.datajud_erro}</span>}
            {processo.datajud_status === "nao_suportado" && <span style={{ color: COLORS.wine }}> — {processo.datajud_erro}</span>}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {!loading && movimentacoes.length === 0 && (
            <p className="text-sm text-center py-6" style={{ color: COLORS.slate }}>Nenhum andamento sincronizado ainda.</p>
          )}
          {movimentacoes.map((m) => (
            <Card key={m.id} style={m.requer_atencao ? { borderLeft: `4px solid ${COLORS.wine}` } : undefined}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  {m.requer_atencao ? <AlertTriangle size={14} color={COLORS.wine} className="mt-0.5 shrink-0" /> : <Clock size={14} color={COLORS.slate} className="mt-0.5 shrink-0" />}
                  <div>
                    <p className="text-sm" style={{ color: COLORS.ink, fontWeight: 600 }}>{m.nome}</p>
                    <p className="text-xs mt-0.5" style={{ color: COLORS.slate }}>{new Date(m.data_hora).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
                {m.requer_atencao && onRegistrarPrazo && (
                  <button
                    onClick={() => onRegistrarPrazo(m)}
                    className="text-xs underline shrink-0"
                    style={{ color: COLORS.brass }}
                  >
                    Registrar prazo
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
    </>
  );

  if (embutido) return conteudo;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg h-full overflow-y-auto p-6" style={{ background: COLORS.paper, borderLeft: `1px solid ${COLORS.line}`, boxShadow: "-20px 0 48px rgba(22,35,59,0.18)" }} onClick={(e) => e.stopPropagation()}>
        {conteudo}
      </div>
    </div>
  );
}
