import React, { useEffect, useRef, useState } from "react";
import { X, CreditCard } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { useEscClose } from "../hooks/useEscClose.js";
import { supabase } from "../lib/supabaseClient.js";
import { PLANOS_ASSINAVEIS, planoLabelCompleto, valorCobranca, DESCONTO_ANUAL } from "../config/planos.js";

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
//   'assinar': plano grátis -> pago, precisa de cartão novo (Payment Brick) e escolhe o ciclo
//     de cobrança (mensal ou o ano inteiro de uma vez, com 5% de desconto).
//   'cartao': assinatura já ativa, só troca o cartão (Payment Brick de novo, mesmo plano e
//     mesmo ciclo — trocar de ciclo é assinar de novo, não dá pra fazer aqui).
//   'trocar': assinatura já ativa, upgrade/downgrade de plano SEM pedir cartão de novo (o
//     Mercado Pago já tem um em arquivo — mercado-pago-criar-assinatura só ajusta o valor,
//     mantendo o ciclo que a assinatura já tinha).
// SDK JS do Mercado Pago (Card Payment Brick, v2) tokeniza o cartão dentro do próprio
// browser quando precisa — só o token (card_token_id) vai pra Edge Function, nunca o número.
export default function AssinaturaModal({ modo, planoAtual, cicloAtual, onClose, onAtualizado }) {
  useEscClose(onClose);
  const requerCartao = modo !== "trocar";
  const opcoesPlano = modo === "cartao" ? PLANOS_ASSINAVEIS.filter((p) => p.value === planoAtual) : PLANOS_ASSINAVEIS;
  const [plano, setPlano] = useState(modo === "cartao" ? planoAtual : (opcoesPlano.find((p) => p.value !== planoAtual)?.value ?? opcoesPlano[0]?.value));
  // Ciclo só é escolhível ao assinar do zero — trocar de cartão/plano mantém o que já existia.
  const [ciclo, setCiclo] = useState(modo === "assinar" ? "mensal" : (cicloAtual ?? "mensal"));
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const containerRef = useRef(null);
  const brickRef = useRef(null);
  const planoEscolhido = PLANOS_ASSINAVEIS.find((p) => p.value === plano);

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

  useEffect(() => {
    if (!requerCartao) return; // modo 'trocar' não usa Brick
    let cancelado = false;
    setErro("");
    carregarSdkMercadoPago()
      .then(() => {
        if (cancelado || !containerRef.current || !planoEscolhido) return;
        const publicKey = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY;
        if (!publicKey) { setErro("Assinatura ainda não foi configurada (chave pública do Mercado Pago ausente)."); return; }
        containerRef.current.innerHTML = "";
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        mp.bricks()
          .create("cardPayment", containerRef.current.id, {
            initialization: { amount: valorCobranca(planoEscolhido.valor, ciclo) },
            callbacks: {
              onReady: () => {},
              onError: (err) => setErro(err?.message ?? "Não foi possível carregar o formulário de cartão."),
              onSubmit: (formData) =>
                new Promise((resolve, reject) => {
                  setEnviando(true);
                  setErro("");
                  supabase.functions
                    .invoke("mercado-pago-criar-assinatura", { body: { plano, card_token_id: formData.token, ciclo } })
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
  }, [plano, ciclo, requerCartao]);

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

        {modo !== "cartao" && (
          <label className="flex flex-col gap-1.5 text-xs mb-4" style={{ color: COLORS.slate }}>
            Plano
            <select value={plano} onChange={(e) => setPlano(e.target.value)} className="px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
              {opcoesPlano.map((p) => (
                <option key={p.value} value={p.value}>{planoLabelCompleto(p)}</option>
              ))}
            </select>
          </label>
        )}

        {modo === "assinar" && planoEscolhido && (
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

        {modo === "assinar" && (
          <p className="text-xs mb-3" style={{ color: COLORS.slate }}>
            Fidelidade mínima de 3 meses a partir da confirmação do primeiro pagamento — depois disso, cancela quando quiser.
          </p>
        )}

        {requerCartao ? (
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
        {enviando && requerCartao && <p className="text-xs mt-3" style={{ color: COLORS.slate }}>Confirmando...</p>}
      </div>
    </div>
  );
}
