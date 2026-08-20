import React, { useMemo, useState } from "react";
import { X, Upload, Check } from "lucide-react";
import Card from "../Card.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../data/mockData.js";
import { parseExtrato } from "../../lib/extratoParser.js";

// Casa entradas do extrato com cobranças pendentes por valor exato (±1 centavo) + vencimento
// mais próximo da data da entrada — cada honorário só é usado uma vez (o de match mais
// próximo "ganha" antes dos outros com o mesmo valor).
function casarComPendentes(entradas, pendentes) {
  const usados = new Set();
  return entradas.map((entrada) => {
    const candidatos = pendentes
      .filter((h) => !usados.has(h.id) && Math.abs(Number(h.valor) - entrada.valor) < 0.01)
      .sort((a, b) => Math.abs(new Date(a.vencimento) - new Date(entrada.data)) - Math.abs(new Date(b.vencimento) - new Date(entrada.data)));
    const match = candidatos[0] ?? null;
    if (match) usados.add(match.id);
    return { ...entrada, match, confirmar: !!match };
  });
}

export default function ImportarExtratoModal({ honorarios, onConfirmar, onClose }) {
  const pendentes = useMemo(() => honorarios.filter((h) => h.status !== "Pago"), [honorarios]);
  const [linhas, setLinhas] = useState(null); // null = ainda não subiu arquivo
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const abrirArquivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCarregando(true);
    setErro("");
    try {
      const entradas = await parseExtrato(file);
      if (entradas.length === 0) setErro("Não encontrei nenhuma entrada de crédito nesse arquivo. Confira se é o extrato certo (OFX ou CSV com data;valor;descrição).");
      setLinhas(casarComPendentes(entradas, pendentes));
    } catch {
      setErro("Não consegui ler esse arquivo.");
    } finally {
      setCarregando(false);
    }
  };

  const alternar = (i) => setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, confirmar: !l.confirmar } : l)));

  const confirmar = async () => {
    const ids = linhas.filter((l) => l.match && l.confirmar).map((l) => l.match.id);
    if (ids.length === 0) return onClose();
    setSalvando(true);
    await onConfirmar(ids);
    setSalvando(false);
    onClose();
  };

  const comMatch = linhas?.filter((l) => l.match).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 16, color: COLORS.ink }}>Importar extrato</p>
            <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
          </div>

          {linhas === null ? (
            <div>
              <p className="text-sm mb-4" style={{ color: COLORS.slate }}>
                Suba o extrato baixado do banco (arquivo <strong>.ofx</strong>, ou <strong>.csv</strong> com colunas
                data;valor;descrição). O sistema casa as entradas com as cobranças em aberto pelo valor e sugere
                marcar como pago — você confere antes de confirmar.
              </p>
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm cursor-pointer w-fit" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
                <Upload size={14} /> {carregando ? "Lendo..." : "Escolher arquivo"}
                <input type="file" accept=".ofx,.csv,.txt" className="hidden" disabled={carregando} onChange={abrirArquivo} />
              </label>
              {erro && <p className="text-xs mt-3" style={{ color: COLORS.wine }}>{erro}</p>}
            </div>
          ) : (
            <div>
              <p className="text-sm mb-3" style={{ color: COLORS.slate }}>
                {linhas.length} entrada(s) de crédito encontrada(s), {comMatch} com cobrança correspondente.
              </p>
              <div className="flex flex-col gap-2 mb-4">
                {linhas.map((l, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, opacity: l.match ? 1 : 0.55 }}>
                    <div className="min-w-0">
                      <p style={{ color: COLORS.ink, fontWeight: 600 }}>{BRL(l.valor)} <span className="font-normal" style={{ color: COLORS.slate }}>— {new Date(`${l.data}T00:00:00`).toLocaleDateString("pt-BR")}</span></p>
                      <p className="text-xs truncate" style={{ color: COLORS.slate }}>
                        {l.match ? `Cobrança de ${l.match.cliente?.nome ?? "cliente"} (venc. ${new Date(`${l.match.vencimento}T00:00:00`).toLocaleDateString("pt-BR")})` : (l.memo || "Sem cobrança pendente com esse valor")}
                      </p>
                    </div>
                    {l.match && (
                      <button
                        onClick={() => alternar(i)}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold"
                        style={{ background: l.confirmar ? COLORS.success : "transparent", color: l.confirmar ? "#fff" : COLORS.slate, border: `1px solid ${l.confirmar ? COLORS.success : COLORS.line}` }}
                      >
                        <Check size={12} /> {l.confirmar ? "Vai marcar" : "Ignorar"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-3.5 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.slate }}>Cancelar</button>
                <button
                  onClick={confirmar}
                  disabled={salvando}
                  className="px-3.5 py-2 rounded-md text-sm font-semibold"
                  style={{ background: COLORS.ink, color: "#fff", opacity: salvando ? 0.6 : 1 }}
                >
                  {salvando ? "Salvando..." : `Marcar ${linhas.filter((l) => l.match && l.confirmar).length} como pago`}
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
