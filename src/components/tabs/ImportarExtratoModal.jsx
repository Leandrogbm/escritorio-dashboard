import React, { useMemo, useState } from "react";
import { X, Upload } from "lucide-react";
import Card from "../Card.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../data/mockData.js";
import { parseExtrato } from "../../lib/extratoParser.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
import { useEscClose } from "../../hooks/useEscClose.js";

// "João da Silva Pix" → "joao da silva pix" — sem acento, sem pontuação, pra comparar nome
// de quem fez o PIX (memo do extrato) com o nome do cliente sem diferença boba de formatação.
const ACENTOS = { á: "a", à: "a", ã: "a", â: "a", é: "e", ê: "e", í: "i", ó: "o", ô: "o", õ: "o", ú: "u", ü: "u", ç: "c" };
function normalizarNome(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[áàãâéêíóôõúüç]/g, (c) => ACENTOS[c])
    .replace(/[^a-z0-9\s]/g, "").trim();
}

// Quanto do nome do cliente aparece no memo do extrato (fração de palavras em comum,
// ignorando conectivos curtos tipo "de"/"da") — 0 se não bate nada, até 1 se bate tudo.
function pontuarNome(memo, nomeCliente) {
  const memoNorm = normalizarNome(memo);
  const palavrasCliente = normalizarNome(nomeCliente).split(/\s+/).filter((p) => p.length > 2);
  if (!memoNorm || palavrasCliente.length === 0) return 0;
  const bateram = palavrasCliente.filter((p) => memoNorm.includes(p)).length;
  return bateram / palavrasCliente.length;
}

// Casa entradas do extrato com cobranças pendentes: valor exato (±1 centavo) é obrigatório;
// entre os candidatos de mesmo valor, desempata por nome do PIX/depositante batendo com o
// nome do cliente (peso maior) e data mais próxima do vencimento (peso menor) — cada
// honorário só é usado uma vez (o de maior pontuação "ganha" antes dos outros).
function casarComPendentes(entradas, pendentes) {
  const usados = new Set();
  return entradas.map((entrada) => {
    const candidatos = pendentes
      .filter((h) => !usados.has(h.id) && Math.abs(Number(h.valor) - entrada.valor) < 0.01)
      .map((h) => {
        const diasDiferenca = Math.abs(new Date(h.vencimento) - new Date(entrada.data)) / 86400000;
        const pontuacaoNome = pontuarNome(entrada.memo, h.cliente?.nome);
        // nome batendo pesa muito mais que data — um match de valor+nome é bem mais confiável
        // que valor+data (várias cobranças podem vencer perto uma da outra)
        return { h, pontuacao: pontuacaoNome * 100 - diasDiferenca };
      })
      .sort((a, b) => b.pontuacao - a.pontuacao);
    const match = candidatos[0]?.h ?? null;
    if (match) usados.add(match.id);
    return { ...entrada, match };
  });
}

// Não confirma pagamento aqui na hora — cada match vira uma notificação "Possível pagamento"
// (sino, tipo pagamento_possivel), pra confirmar/rejeitar com calma dali, com 👍/👎.
export default function ImportarExtratoModal({ honorarios, orgId, onClose }) {
  useEscClose(onClose);
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { insert: insertNotificacao } = useSupabaseTable("notificacoes", { eq: orgEq });
  const pendentes = useMemo(() => honorarios.filter((h) => h.status !== "Pago"), [honorarios]);
  const [linhas, setLinhas] = useState(null); // null = ainda não subiu arquivo
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  const abrirArquivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCarregando(true);
    setErro("");
    try {
      const entradas = await parseExtrato(file);
      if (entradas.length === 0) {
        setErro("Não encontrei nenhuma entrada de crédito nesse arquivo. Confira se é o extrato certo (OFX ou CSV com data;valor;descrição).");
        return;
      }
      const casadas = casarComPendentes(entradas, pendentes);
      setLinhas(casadas);
      const comMatch = casadas.filter((l) => l.match);
      if (comMatch.length > 0) {
        await insertNotificacao(comMatch.map((l) => ({
          tipo: "pagamento_possivel",
          honorario_id: l.match.id,
          titulo: `Possível pagamento — ${l.match.cliente?.nome ?? "cliente"}`,
          texto: `${BRL(l.valor)} em ${new Date(`${l.data}T00:00:00`).toLocaleDateString("pt-BR")}${l.memo ? ` — "${l.memo}"` : ""}`,
        })));
      }
      setEnviado(true);
    } catch {
      setErro("Não consegui ler esse arquivo.");
    } finally {
      setCarregando(false);
    }
  };

  const comMatch = linhas?.filter((l) => l.match).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card style={{ boxShadow: "0 20px 48px rgba(22,35,59,0.22)" }}>
          <div className="flex items-center justify-between mb-4">
            <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 16, color: COLORS.ink }}>Importar extrato</p>
            <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
          </div>

          {!enviado ? (
            <div>
              <p className="text-sm mb-4" style={{ color: COLORS.slate }}>
                Suba o extrato baixado do banco: <strong>.ofx</strong> ou <strong>.csv</strong> (data;valor;descrição)
                se o internet banking oferecer, o <strong>.pdf</strong> do extrato do app, ou até uma <strong>foto</strong>
                do extrato (lê o texto da imagem automaticamente — menos preciso que PDF/OFX, então linha com valor
                e saldo juntos, por exemplo, é ignorada em vez de arriscar um match errado). O sistema casa as
                entradas com as cobranças em aberto por valor, data e nome de quem pagou — cada match vira uma
                notificação no sino, pra confirmar ou rejeitar de lá.
              </p>
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm cursor-pointer w-fit" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
                <Upload size={14} /> {carregando ? "Lendo..." : "Escolher arquivo ou foto"}
                <input type="file" accept=".ofx,.csv,.txt,.pdf,image/*" className="hidden" disabled={carregando} onChange={abrirArquivo} />
              </label>
              {carregando && <p className="text-xs mt-2" style={{ color: COLORS.slate }}>Foto pode demorar alguns segundos a mais pra ler.</p>}
              {erro && <p className="text-xs mt-3" style={{ color: COLORS.wine }}>{erro}</p>}
            </div>
          ) : (
            <div>
              <p className="text-sm mb-4" style={{ color: COLORS.ink }}>
                {linhas.length} entrada(s) de crédito encontrada(s), {comMatch} com cobrança correspondente.
                {comMatch > 0 ? " Enviado pro sino de notificações — confirme ou rejeite cada possível pagamento por lá." : ""}
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
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button onClick={onClose} className="px-3.5 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>Fechar</button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
