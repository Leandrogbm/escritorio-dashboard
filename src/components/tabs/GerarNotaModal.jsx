import React, { useState } from "react";
import { X, Receipt, AlertTriangle } from "lucide-react";
import Card from "../Card.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../data/mockData.js";
import { supabase } from "../../lib/supabaseClient.js";

// Ainda não existe emissor fiscal real conectado (falta escolher provedor — Focus NFe/eNotas/
// PlugNotas — e certificado digital A1 da empresa). Isso aqui só organiza os dados e deixa o
// registro em notas_fiscais como "pendente", pronto pra virar emissão de verdade no dia que
// a integração entrar — não transmite nada pra prefeitura ainda.
export default function GerarNotaModal({ honorario, org, onGerada, onClose }) {
  const cliente = honorario.cliente;
  const mesRef = new Date(`${honorario.vencimento}T00:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const [descricao, setDescricao] = useState(
    honorario.descricao_servico || `Honorários advocatícios — mensalidade ${mesRef} — ${cliente?.nome ?? ""}`
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const faltaInscricao = !org?.inscricao_municipal;

  const gerar = async () => {
    setSalvando(true);
    setErro("");
    const { error } = await supabase.from("notas_fiscais").insert({
      honorario_id: honorario.id,
      cliente_id: cliente?.id,
      valor: honorario.valor,
      descricao_servico: descricao,
    });
    setSalvando(false);
    if (error) return setErro(error.code === "23505" ? "Já existe uma nota gerada pra essa cobrança." : error.message);
    onGerada?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="flex items-center gap-2" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 16, color: COLORS.ink }}>
              <Receipt size={18} color={COLORS.brass} /> Gerar nota fiscal
            </p>
            <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
          </div>

          <p className="text-sm mb-1" style={{ color: COLORS.ink }}>{cliente?.nome}</p>
          <p className="text-2xl mb-4" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.success }}>{BRL(honorario.valor)}</p>

          <label className="flex flex-col gap-1 text-xs mb-4" style={{ color: COLORS.slate }}>
            Descrição do serviço (vai impressa na nota)
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="px-3 py-2 rounded-md text-sm"
              style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
            />
          </label>

          {faltaInscricao && (
            <div className="flex items-start gap-1.5 mb-4 px-2.5 py-2 rounded-md text-xs" style={{ background: "rgba(165,121,59,0.1)", color: COLORS.brass }}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              Falta a Inscrição Municipal da empresa (aba Minha Empresa) — a maioria das prefeituras exige pra emitir de verdade. Dá pra gerar o rascunho mesmo assim.
            </div>
          )}

          <p className="text-xs mb-4" style={{ color: COLORS.slate }}>
            Sem emissor fiscal conectado ainda, isso só organiza os dados como "pendente" — não emite/transmite nada pra prefeitura.
          </p>

          {erro && <p className="text-xs mb-3" style={{ color: COLORS.wine }}>{erro}</p>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3.5 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.slate }}>Cancelar</button>
            <button
              onClick={gerar}
              disabled={salvando || !descricao.trim()}
              className="px-3.5 py-2 rounded-md text-sm font-semibold"
              style={{ background: COLORS.ink, color: "#fff", opacity: salvando ? 0.6 : 1 }}
            >
              {salvando ? "Gerando..." : "Gerar rascunho"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
