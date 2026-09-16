import React, { useEffect, useRef, useState } from "react";
import { X, CreditCard, QrCode, Copy } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { useEscClose } from "../hooks/useEscClose.js";
import { supabase } from "../lib/supabaseClient.js";
import { PLANOS_ASSINAVEIS, planoLabelCompleto, valorCobranca, DESCONTO_ANUAL, valorPagamentoAvulso, DESCONTO_PAGAMENTO_AVULSO } from "../config/planos.js";

const MP_SDK_SRC = "https://sdk.mercadopago.com/js/v2";
const TITULOS = { assinar: "Assinar plano", trocar: "Trocar de plano", cartao: "Atualizar forma de pagamento" };

function carregarSdkMercadoPago() {
  if (window.MercadoPago) return Promise.resolve();
  const existente = document.querySelector(`script[src="${MP_SDK_SRC}"]`);
  if (existente) return new Promise((resolve, reject) => { existente.addEventListener("load", () => resolve()); existente.addEventListener("error", () => reject(new Error("Não foi possível carregar o Mercado Pago."))); });
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = MP_SDK_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Não foi possível carregar o Mercado Pago."));
    document.body.appendChild(script);
  });
}

// Assina, troca de plano ou troca a forma de pagamento — 3 modos, mesmo componente:
//   'assinar': plano grátis/expirado -> pago. Dois MÉTODOS possíveis (só aqui, os outros modos
//     são sempre cartão de assinatura recorrente): cartão ou PIX. Cada um com dois FORMATOS:
//       - recorrente (só cartão): Payment Brick, ciclo mensal ou anual com desconto, gera
//         assinatura de verdade (Preapproval) — cancelável, fidelidade de 3 meses.
//       - avulso/pré-pago (cartão OU PIX): pagamento único, pré-paga 3/6/12 meses de acesso
//         com desconto (3%/4%/5%) — sem token salvo, NUNCA vira assinatura, e por isso NUNCA é
//         cancelável (já foi cobrado o valor total; ver mercado-pago-criar-pix/
//         mercado-pago-criar-pagamento-cartao). Quando o período acaba, é só pagar de novo.
//   'cartao': assinatura de cartão já ativa, só troca o cartão (Payment Brick de novo, mesmo
//     plano e mesmo ciclo — trocar de ciclo é assinar de novo, não dá pra fazer aqui).
//   'trocar': assinatura de cartão já ativa, upgrade/downgrade de plano SEM pedir cartão de
//     novo (o Mercado Pago já tem um em arquivo — mercado-pago-criar-assinatura só ajusta o
//     valor, mantendo o ciclo que a assinatura já tinha).
// SDK JS do Mercado Pago (Card Payment Brick, v2) tokeniza o cartão dentro do próprio
// browser quando precisa — só o token (e os campos que o Brick já coletou) vai pra Edge
// Function, nunca o número do cartão.
export default function AssinaturaModal({ modo, planoAtual, cicloAtual, onClose, onAtualizado }) {
  useEscClose(onClose);
  const requerCartao = modo !== "trocar";
  const opcoesPlano = modo === "cartao" ? PLANOS_ASSINAVEIS.filter((p) => p.value === planoAtual) : PLANOS_ASSINAVEIS;
  // 'cartao': sempre o plano atual (só troca o cartão). 'trocar': começa num plano DIFERENTE
  // do atual (é upgrade/downgrade). 'assinar': se a org já tinha um plano pago (repagar depois
  // de vencer/atrasar), mantém o mesmo por padrão — só cai pro primeiro da lista quando vem do
  // grátis (nunca era um plano assinável pra começar).
  const [plano, setPlano] = useState(() => {
    if (modo === "cartao") return planoAtual;
    if (modo === "assinar" && opcoesPlano.some((p) => p.value === planoAtual)) return planoAtual;
    return opcoesPlano.find((p) => p.value !== planoAtual)?.value ?? opcoesPlano[0]?.value;
  });
  // Método/formato só são escolhíveis ao assinar do zero — trocar cartão/plano de uma
  // assinatura recorrente já existente é sempre cartão recorrente (PIX e pré-pago não têm
  // token salvo pra "trocar", são sempre pagamento novo).
  const [metodo, setMetodo] = useState("cartao"); // 'cartao' | 'pix', só relevante em modo='assinar'
  const [formatoCartao, setFormatoCartao] = useState("recorrente"); // 'recorrente' | 'avulso', só cartão+assinar
  // Ciclo só é escolhível ao assinar do zero — trocar de cartão/plano mantém o que já existia.
  const [ciclo, setCiclo] = useState(modo === "assinar" ? "mensal" : (cicloAtual ?? "mensal"));
  const [meses, setMeses] = useState(3); // período do pré-pago (cartão avulso OU PIX)
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const containerRef = useRef(null);
  const brickRef = useRef(null);
  const planoEscolhido = PLANOS_ASSINAVEIS.find((p) => p.value === plano);

  // PIX: pagamento único por período, sem Brick — só gera o QR code e exibe.
  const [pixDados, setPixDados] = useState(null); // { qr_code, qr_code_base64, valor }
  const [copiado, setCopiado] = useState(false);

  const usaPix = modo === "assinar" && metodo === "pix";
  const cartaoAvulso = modo === "assinar" && metodo === "cartao" && formatoCartao === "avulso";
  const ehPrePago = usaPix || cartaoAvulso; // pagamento único, nunca cancelável

  const confirmarTroca = async () => {
    setEnviando(true);
    setErro("");
    const { error } = await supabase.functions.invoke("mercado-pago-criar-assinatura", { body: { plano } });
    setEnviando(false);
    if (error) {
      const corpo = await error.context?.json?.().catch(() => null);
      setErro(corpo?.error ?? error.message);
      return;
    }
    onAtualizado?.();
    onClose();
  };

  const gerarPix = async () => {
    setEnviando(true);
    setErro("");
    setPixDados(null);
    const { data, error } = await supabase.functions.invoke("mercado-pago-criar-pix", { body: { plano, meses } });
    setEnviando(false);
    if (error) {
      const corpo = await error.context?.json?.().catch(() => null);
      setErro(corpo?.error ?? error.message);
      return;
    }
    setPixDados(data);
  };

  const copiarCodigoPix = () => {
    navigator.clipboard?.writeText(pixDados?.qr_code ?? "");
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  useEffect(() => {
    if (!requerCartao || usaPix) return; // modo 'trocar' e método PIX não usam o Brick
    let cancelado = false;
    setErro("");
    carregarSdkMercadoPago()
      .then(() => {
        if (cancelado || !containerRef.current || !planoEscolhido) return;
        const publicKey = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY;
        if (!publicKey) { setErro("Assinatura ainda não foi configurada (chave pública do Mercado Pago ausente)."); return; }
        containerRef.current.innerHTML = "";
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        const amount = cartaoAvulso ? valorPagamentoAvulso(planoEscolhido.valor, meses) : valorCobranca(planoEscolhido.valor, ciclo);
        mp.bricks()
          .create("cardPayment", containerRef.current.id, {
            initialization: { amount },
            callbacks: {
              onReady: () => {},
              onError: (err) => setErro(err?.message ?? "Não foi possível carregar o formulário de cartão."),
              onSubmit: (formData) =>
                new Promise((resolve, reject) => {
                  setEnviando(true);
                  setErro("");
                  const chamada = cartaoAvulso
                    ? supabase.functions.invoke("mercado-pago-criar-pagamento-cartao", { body: { plano, meses, brickData: formData } })
                    : supabase.functions.invoke("mercado-pago-criar-assinatura", { body: { plano, card_token_id: formData.token, ciclo } });
                  chamada
                    .then(async ({ error }) => {
                      setEnviando(false);
                      if (error) {
                        const corpo = await error.context?.json?.().catch(() => null);
                        const msg = corpo?.error ?? error.message;
                        setErro(msg);
                        reject(msg);
                        return;
                      }
                      resolve();
                      onAtualizado?.();
                    })
                    .catch((e) => { setEnviando(false); setErro(e.message); reject(e); });
                }),
            },
          })
          .then((brick) => { if (cancelado) brick.unmount(); else brickRef.current = brick; });
      })
      .catch((e) => setErro(e.message));
    return () => {
      cancelado = true;
      brickRef.current?.unmount?.();
      brickRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plano, ciclo, meses, requerCartao, usaPix, cartaoAvulso]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,35,59,0.35)" }}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg p-6" style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}` }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard size={18} color={COLORS.brass} />
            <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 18, color: COLORS.ink }}>{TITULOS[modo]}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
        </div>

        {modo === "assinar" && (
          <div className="flex gap-2 mb-4">
            {[{ value: "cartao", label: "Cartão de crédito" }, { value: "pix", label: "PIX" }].map((op) => (
              <button
                key={op.value}
                type="button"
                onClick={() => { setMetodo(op.value); setErro(""); setPixDados(null); }}
                className="flex-1 px-3 py-2 rounded-md text-sm font-semibold"
                style={{
                  border: `1px solid ${metodo === op.value ? COLORS.brass : COLORS.line}`,
                  background: metodo === op.value ? "rgba(165,121,59,0.08)" : "transparent",
                  color: COLORS.ink,
                }}
              >
                {op.label}
              </button>
            ))}
          </div>
        )}

        {modo === "assinar" && metodo === "cartao" && (
          <div className="flex gap-2 mb-4">
            {[{ value: "recorrente", label: "Assinatura mensal/anual" }, { value: "avulso", label: "Pagamento único (3/6/12 meses)" }].map((op) => (
              <button
                key={op.value}
                type="button"
                onClick={() => setFormatoCartao(op.value)}
                className="flex-1 px-2.5 py-2 rounded-md text-xs font-semibold"
                style={{
                  border: `1px solid ${formatoCartao === op.value ? COLORS.brass : COLORS.line}`,
                  background: formatoCartao === op.value ? "rgba(165,121,59,0.08)" : "transparent",
                  color: COLORS.ink,
                }}
              >
                {op.label}
              </button>
            ))}
          </div>
        )}

        {modo !== "cartao" && (
          <label className="flex flex-col gap-1.5 text-xs mb-4" style={{ color: COLORS.slate }}>
            Plano
            <select value={plano} onChange={(e) => { setPlano(e.target.value); setPixDados(null); }} className="px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
              {opcoesPlano.map((p) => (
                <option key={p.value} value={p.value}>{planoLabelCompleto(p)}</option>
              ))}
            </select>
          </label>
        )}

        {modo === "assinar" && metodo === "cartao" && formatoCartao === "recorrente" && planoEscolhido && (
          <div className="flex flex-col gap-1.5 text-xs mb-4" style={{ color: COLORS.slate }}>
            Cobrança
            <div className="flex gap-2">
              {[
                { value: "mensal", label: "Mensal", desc: `R$${planoEscolhido.valor}/mês` },
                { value: "anual", label: "Anual", desc: `R$${valorCobranca(planoEscolhido.valor, "anual")}/ano (${DESCONTO_ANUAL * 100}% off)` },
              ].map((op) => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setCiclo(op.value)}
                  className="flex-1 px-3 py-2 rounded-md text-left"
                  style={{
                    border: `1px solid ${ciclo === op.value ? COLORS.brass : COLORS.line}`,
                    background: ciclo === op.value ? "rgba(165,121,59,0.08)" : "transparent",
                  }}
                >
                  <span className="block font-semibold" style={{ color: COLORS.ink }}>{op.label}</span>
                  <span className="block">{op.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {ehPrePago && planoEscolhido && (
          <div className="flex flex-col gap-1.5 text-xs mb-4" style={{ color: COLORS.slate }}>
            Período (pagamento único, sem renovação automática)
            <div className="grid grid-cols-3 gap-2">
              {[3, 6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMeses(m); setPixDados(null); }}
                  className="px-2 py-2 rounded-md text-center"
                  style={{
                    border: `1px solid ${meses === m ? COLORS.brass : COLORS.line}`,
                    background: meses === m ? "rgba(165,121,59,0.08)" : "transparent",
                  }}
                >
                  <span className="block font-semibold" style={{ color: COLORS.ink }}>{m} meses</span>
                  <span className="block">R${valorPagamentoAvulso(planoEscolhido.valor, m)}</span>
                  <span className="block">({DESCONTO_PAGAMENTO_AVULSO[m] * 100}% off)</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {modo === "assinar" && metodo === "cartao" && formatoCartao === "recorrente" && (
          <p className="text-xs mb-3" style={{ color: COLORS.slate }}>
            Fidelidade mínima de 3 meses a partir da confirmação do primeiro pagamento — depois disso, cancela quando quiser.
          </p>
        )}
        {ehPrePago && (
          <p className="text-xs mb-3" style={{ color: COLORS.slate }}>
            Pagamento único, cobrado de uma vez só — sem fidelidade, sem renovação automática e{" "}
            <strong style={{ color: COLORS.ink }}>sem cancelamento</strong> (já paga o período inteiro, não tem como devolver parcial).
            O acesso vale até o fim do período; pra continuar depois, é só pagar de novo.
          </p>
        )}

        {usaPix ? (
          pixDados ? (
            <div className="flex flex-col items-center gap-2 mt-1">
              <img src={`data:image/png;base64,${pixDados.qr_code_base64}`} alt="QR Code do PIX" className="w-48 h-48" />
              <p className="text-xs" style={{ color: COLORS.ink }}>R${pixDados.valor} · escaneie ou copie o código abaixo</p>
              <button
                type="button"
                onClick={copiarCodigoPix}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold w-full justify-center"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
              >
                <Copy size={13} /> {copiado ? "Copiado!" : "Copiar código PIX"}
              </button>
              <p className="text-xs text-center" style={{ color: COLORS.slate }}>
                Assim que o pagamento for confirmado (geralmente em segundos), o acesso é liberado automaticamente — pode fechar esta janela.
              </p>
            </div>
          ) : (
            <button
              onClick={gerarPix}
              disabled={enviando}
              className="w-full mt-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-md text-sm font-semibold"
              style={{ background: COLORS.brass, color: "#fff", opacity: enviando ? 0.6 : 1 }}
            >
              <QrCode size={16} /> {enviando ? "Gerando..." : "Gerar QR Code PIX"}
            </button>
          )
        ) : requerCartao ? (
          <div id="assinatura-brick-container" ref={containerRef} />
        ) : (
          <button
            onClick={confirmarTroca}
            disabled={enviando || plano === planoAtual}
            className="w-full mt-1 px-3.5 py-2.5 rounded-md text-sm font-semibold"
            style={{ background: COLORS.brass, color: "#fff", opacity: enviando || plano === planoAtual ? 0.6 : 1 }}
          >
            {enviando ? "Confirmando..." : "Confirmar troca de plano"}
          </button>
        )}

        {erro && <p className="text-xs mt-3" style={{ color: COLORS.wine }}>{erro}</p>}
        {enviando && requerCartao && !usaPix && <p className="text-xs mt-3" style={{ color: COLORS.slate }}>Confirmando...</p>}
      </div>
    </div>
  );
}
