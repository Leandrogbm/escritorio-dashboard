import React, { useEffect, useMemo, useState } from "react";
import { X, Loader2 } from "lucide-react";
import Card from "../Card.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../data/mockData.js";
import { parseExtrato } from "../../lib/extratoParser.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";

// "João da Silva Pix" → "joao da silva pix" — sem acento, sem pontuação, pra comparar nome
// de quem fez o PIX (memo do extrato) com o nome do cliente/fornecedor sem diferença boba
// de formatação.
const ACENTOS = { á: "a", à: "a", ã: "a", â: "a", é: "e", ê: "e", í: "i", ó: "o", ô: "o", õ: "o", ú: "u", ü: "u", ç: "c" };
function normalizarNome(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[áàãâéêíóôõúüç]/g, (c) => ACENTOS[c])
    .replace(/[^a-z0-9\s]/g, "").trim();
}

// Quanto do nome (cliente ou fornecedor) aparece no memo do extrato (fração de palavras em
// comum, ignorando conectivos curtos tipo "de"/"da") — 0 se não bate nada, até 1 se bate tudo.
function pontuarNome(memo, nome) {
  const memoNorm = normalizarNome(memo);
  const palavras = normalizarNome(nome).split(/\s+/).filter((p) => p.length > 2);
  if (!memoNorm || palavras.length === 0) return 0;
  const bateram = palavras.filter((p) => memoNorm.includes(p)).length;
  return bateram / palavras.length;
}

// Casa entradas/saídas do extrato com cobranças/despesas pendentes: valor exato (±1 centavo)
// é obrigatório; entre candidatos de mesmo valor, desempata por nome batendo com o memo do
// extrato (peso maior) e data mais próxima do vencimento (peso menor) — cada pendente só é
// usado uma vez (o de maior pontuação "ganha" antes dos outros). `getNome`/`getVencimento`
// abstraem se é honorário (cliente.nome/vencimento) ou despesa (fornecedor/vencimento).
function casarComPendentes(linhas, pendentes, getNome, getVencimento) {
  const usados = new Set();
  return linhas.map((linha) => {
    const candidatos = pendentes
      .filter((p) => !usados.has(p.id) && Math.abs(Number(p.valor) - linha.valor) < 0.01)
      .map((p) => {
        const diasDiferenca = Math.abs(new Date(getVencimento(p)) - new Date(linha.data)) / 86400000;
        const pontuacaoNome = pontuarNome(linha.memo, getNome(p));
        // nome batendo pesa muito mais que data — um match de valor+nome é bem mais confiável
        // que valor+data (várias cobranças podem vencer perto uma da outra)
        return { p, pontuacao: pontuacaoNome * 100 - diasDiferenca };
      })
      .sort((a, b) => b.pontuacao - a.pontuacao);
    const match = candidatos[0]?.p ?? null;
    if (match) usados.add(match.id);
    return { ...linha, match };
  });
}

// `arquivo` já vem escolhido de fora (o botão "Importar extrato" abre o seletor nativo direto
// no clique — 1 clique só, funciona em qualquer navegador incluindo Safari/iOS). Isso aqui não
// é mais um popup de "importar" — é só um toast de resultado no canto, não bloqueia a tela.
// Lê o extrato UMA vez e casa nos dois sentidos: crédito (entrada) com honorário a receber,
// débito (saída) com despesa a pagar — funciona igual chamado de Financeiro ou de ERP, cada
// um só passa a tabela que tem à mão (a outra vem vazia e simplesmente não gera match).
// Não confirma pagamento na hora — cada match vira notificação "Possível pagamento" (sino,
// tipo pagamento_possivel/despesa_paga_possivel), pra confirmar/rejeitar com calma dali.
export default function ImportarExtratoModal({ arquivo, honorarios = [], despesas = [], orgId, onClose }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { insert: insertNotificacao } = useSupabaseTable("notificacoes", { eq: orgEq });
  const honorariosPendentes = useMemo(() => honorarios.filter((h) => h.status !== "Pago"), [honorarios]);
  const despesasPendentes = useMemo(() => despesas.filter((d) => d.status !== "Pago"), [despesas]);
  const [entradas, setEntradas] = useState(null); // null = ainda lendo
  const [saidas, setSaidas] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    setEntradas(null);
    setSaidas(null);
    setErro("");
    (async () => {
      try {
        const linhas = await parseExtrato(arquivo);
        if (cancelado) return;
        if (linhas.length === 0) {
          setErro("Não encontrei nenhum valor com data nesse arquivo. Se for foto, tenta tirar de novo com mais luz/foco — ou confira se é o extrato/comprovante certo.");
          return;
        }
        const entradasCasadas = casarComPendentes(
          linhas.filter((l) => l.valor > 0),
          honorariosPendentes, (h) => h.cliente?.nome, (h) => h.vencimento,
        );
        const saidasCasadas = casarComPendentes(
          linhas.filter((l) => l.valor < 0).map((l) => ({ ...l, valor: Math.abs(l.valor) })),
          despesasPendentes, (d) => d.fornecedor || d.descricao, (d) => d.vencimento,
        );

        const notificacoes = [
          ...entradasCasadas.filter((l) => l.match).map((l) => ({
            tipo: "pagamento_possivel",
            honorario_id: l.match.id,
            titulo: `Possível pagamento — ${l.match.cliente?.nome ?? "cliente"}`,
            texto: `${BRL(l.valor)} em ${new Date(`${l.data}T00:00:00`).toLocaleDateString("pt-BR")}${l.memo ? ` — "${l.memo}"` : ""}`,
          })),
          ...saidasCasadas.filter((l) => l.match).map((l) => ({
            tipo: "despesa_paga_possivel",
            despesa_id: l.match.id,
            titulo: `Possível pagamento — ${l.match.fornecedor || l.match.descricao}`,
            texto: `${BRL(l.valor)} em ${new Date(`${l.data}T00:00:00`).toLocaleDateString("pt-BR")}${l.memo ? ` — "${l.memo}"` : ""}`,
          })),
        ];
        if (notificacoes.length > 0) await insertNotificacao(notificacoes);

        if (!cancelado) {
          setEntradas(entradasCasadas);
          setSaidas(saidasCasadas);
        }
      } catch {
        if (!cancelado) setErro("Não consegui ler esse arquivo.");
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo]);

  // Some sozinho 6s depois de mostrar o resultado (sucesso) — erro fica até fechar na mão.
  useEffect(() => {
    if (!entradas && !saidas) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [entradas, saidas, onClose]);

  const linhas = [...(entradas ?? []), ...(saidas ?? [])];
  const comMatch = linhas.filter((l) => l.match).length;
  const lendo = entradas === null && saidas === null && !erro;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm" style={{ animation: "tab-fade-in 200ms ease backwards" }}>
      <Card style={{ boxShadow: "0 12px 32px rgba(22,35,59,0.18)" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Importar extrato</p>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={16} /></button>
        </div>

        {erro ? (
          <p className="text-xs" style={{ color: COLORS.wine }}>{erro}</p>
        ) : lendo ? (
          <p className="flex items-center gap-2 text-xs" style={{ color: COLORS.slate }}>
            <Loader2 size={13} className="animate-spin" /> Lendo "{arquivo.name}"...
            {arquivo.type.startsWith("image/") && " Foto demora um pouco mais."}
          </p>
        ) : (
          <div>
            <p className="text-xs mb-2" style={{ color: COLORS.ink }}>
              {linhas.length} entrada(s) encontrada(s), {comMatch} com correspondência.
              {comMatch > 0 && " Confira no sino."}
            </p>
            {linhas.length > 0 && (
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {linhas.map((l, i) => (
                  <div key={i} className="px-2 py-1.5 rounded text-xs" style={{ border: `1px solid ${COLORS.line}`, opacity: l.match ? 1 : 0.55 }}>
                    <span style={{ color: COLORS.ink, fontWeight: 600 }}>{BRL(l.valor)}</span>
                    <span style={{ color: COLORS.slate }}>
                      {" — "}
                      {l.match
                        ? (l.match.cliente?.nome ?? l.match.fornecedor ?? l.match.descricao ?? "—")
                        : "sem correspondência"}
                    </span>
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
