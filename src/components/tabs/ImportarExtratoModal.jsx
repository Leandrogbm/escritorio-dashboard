import React, { useEffect, useMemo, useState } from "react";
import { X, Loader2 } from "lucide-react";
import Card from "../Card.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../data/mockData.js";
import { parseExtrato } from "../../lib/extratoParser.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";

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

// `arquivo` já vem escolhido de fora (FinanceiroTab abre o seletor nativo direto no clique
// do botão — 1 clique só, funciona em qualquer navegador incluindo Safari/iOS, que exige o
// seletor disparado no mesmo gesto síncrono do clique). Isso aqui não é mais um popup de
// "importar" — é só um toast de resultado no canto, não bloqueia a tela (pedido do usuário:
// já que o arquivo é escolhido direto, não faz sentido ter um popup no meio do caminho).
// Não confirma pagamento na hora — cada match vira notificação "Possível pagamento" (sino,
// tipo pagamento_possivel), pra confirmar/rejeitar com calma dali, com 👍/👎.
export default function ImportarExtratoModal({ arquivo, honorarios, orgId, onClose }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { insert: insertNotificacao } = useSupabaseTable("notificacoes", { eq: orgEq });
  const pendentes = useMemo(() => honorarios.filter((h) => h.status !== "Pago"), [honorarios]);
  const [linhas, setLinhas] = useState(null); // null = ainda lendo
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    setLinhas(null);
    setErro("");
    (async () => {
      try {
        const entradas = await parseExtrato(arquivo);
        if (cancelado) return;
        if (entradas.length === 0) {
          setErro("Não encontrei nenhum valor com data nesse arquivo. Se for foto, tenta tirar de novo com mais luz/foco — ou confira se é o extrato/comprovante certo.");
          return;
        }
        const casadas = casarComPendentes(entradas, pendentes);
        const comMatch = casadas.filter((l) => l.match);
        if (comMatch.length > 0) {
          await insertNotificacao(comMatch.map((l) => ({
            tipo: "pagamento_possivel",
            honorario_id: l.match.id,
            titulo: `Possível pagamento — ${l.match.cliente?.nome ?? "cliente"}`,
            texto: `${BRL(l.valor)} em ${new Date(`${l.data}T00:00:00`).toLocaleDateString("pt-BR")}${l.memo ? ` — "${l.memo}"` : ""}`,
          })));
        }
        if (!cancelado) setLinhas(casadas);
      } catch {
        if (!cancelado) setErro("Não consegui ler esse arquivo.");
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo]);

  // Some sozinho 6s depois de mostrar o resultado (sucesso) — erro fica até fechar na mão.
  useEffect(() => {
    if (!linhas) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [linhas, onClose]);

  const comMatch = linhas?.filter((l) => l.match).length ?? 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm" style={{ animation: "tab-fade-in 200ms ease backwards" }}>
      <Card style={{ boxShadow: "0 12px 32px rgba(22,35,59,0.18)" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Importar extrato</p>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={16} /></button>
        </div>

        {erro ? (
          <p className="text-xs" style={{ color: COLORS.wine }}>{erro}</p>
        ) : !linhas ? (
          <p className="flex items-center gap-2 text-xs" style={{ color: COLORS.slate }}>
            <Loader2 size={13} className="animate-spin" /> Lendo "{arquivo.name}"...
            {arquivo.type.startsWith("image/") && " Foto demora um pouco mais."}
          </p>
        ) : (
          <div>
            <p className="text-xs mb-2" style={{ color: COLORS.ink }}>
              {linhas.length} entrada(s) encontrada(s), {comMatch} com cobrança correspondente.
              {comMatch > 0 && " Confira no sino."}
            </p>
            {linhas.length > 0 && (
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {linhas.map((l, i) => (
                  <div key={i} className="px-2 py-1.5 rounded text-xs" style={{ border: `1px solid ${COLORS.line}`, opacity: l.match ? 1 : 0.55 }}>
                    <span style={{ color: COLORS.ink, fontWeight: 600 }}>{BRL(l.valor)}</span>
                    <span style={{ color: COLORS.slate }}> — {l.match ? (l.match.cliente?.nome ?? "cliente") : "sem cobrança correspondente"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
