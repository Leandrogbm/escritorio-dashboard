import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X, Copy, MessageCircle, QrCode as QrCodeIcon } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { BRL } from "../lib/format.js";
import { useEscClose } from "../hooks/useEscClose.js";
import { gerarPixCopiaCola } from "../lib/pix.js";

// wa.me quer só dígitos com DDI — mesma regra de ClientesTab.jsx (assume Brasil quando o
// número não veio com DDI).
function linkWhatsApp(celular, texto) {
  const digitos = (celular || "").replace(/\D/g, "");
  if (!digitos) return null;
  const comDDI = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${comDDI}?text=${encodeURIComponent(texto)}`;
}

// Cobrança Pix gerada 100% por nós (BR Code estático, ver src/lib/pix.js) — sem Asaas/Mercado
// Pago no meio. Confirmação de pagamento é manual (StatusPicker ou Importar extrato), Pix
// estático não tem webhook.
export default function CobrarPixModal({ honorario, org, cliente, onClose }) {
  const [qr, setQr] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState("");
  useEscClose(onClose, true);

  const temChave = !!org?.pix_chave?.trim();

  const payload = temChave
    ? (() => {
        try {
          return gerarPixCopiaCola({
            chave: org.pix_chave,
            nome: org.pix_nome_recebedor || org.nome,
            cidade: org.pix_cidade,
            valor: honorario.valor,
            txid: honorario.id,
          });
        } catch (e) {
          return null;
        }
      })()
    : null;

  useEffect(() => {
    if (!payload) return;
    QRCode.toDataURL(payload, { width: 220, margin: 1 })
      .then(setQr)
      .catch(() => setErro("Não foi possível gerar o QR Code."));
  }, [payload]);

  const copiar = () => {
    navigator.clipboard?.writeText(payload ?? "");
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const vencimentoFmt = honorario.vencimento ? new Date(`${honorario.vencimento}T00:00:00`).toLocaleDateString("pt-BR") : "";
  const valorFmt = Number(honorario.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const escritorio = (org?.nome || "o escritório").trim();
  const primeiroNome = (cliente?.nome || "").trim().split(/\s+/)[0] || "";
  const mesRef = honorario.vencimento
    ? new Date(`${honorario.vencimento}T00:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "";
  const referente = honorario.descricao_servico?.trim() || `honorários advocatícios${mesRef ? ` de ${mesRef}` : ""}`;
  // Curta e direta: de onde vem, quanto, até quando, como pagar. Código por último, sozinho.
  const mensagemWhats = [
    `Olá${primeiroNome ? `, ${primeiroNome}` : ""}! Tudo bem?`,
    `Segue a sua mensalidade com o *${escritorio}*:`,
    "",
    `*Referente a:* ${referente}`,
    `*Valor:* ${valorFmt}`,
    `*Vencimento:* ${vencimentoFmt}`,
    "",
    "Para pagar, copie o código abaixo e cole no app do seu banco em *Pix → Pix Copia e Cola*.",
    "Se já pagou, desconsidere. Qualquer dúvida, estamos à disposição.",
    "",
    payload ?? "",
  ].join("\n");
  const whats = payload ? linkWhatsApp(cliente?.celular, mensagemWhats) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,35,59,0.45)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg p-5" style={{ background: COLORS.paper }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="flex items-center gap-1.5" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 16, color: COLORS.ink }}>
            <QrCodeIcon size={16} color={COLORS.brass} /> Cobrar via Pix
          </p>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
        </div>

        {!temChave ? (
          <p className="text-sm" style={{ color: COLORS.slate }}>
            Nenhuma chave Pix cadastrada ainda. Configure em <strong>Minha Empresa</strong> (admin/sócio) pra gerar cobranças por aqui.
          </p>
        ) : erro || !payload ? (
          <p className="text-sm" style={{ color: COLORS.wine }}>{erro || "Não foi possível montar a cobrança."}</p>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs" style={{ color: COLORS.slate }}>{BRL(honorario.valor)} · vence {vencimentoFmt}</p>
            {qr ? <img src={qr} alt="QR Code Pix" className="w-52 h-52" /> : <div className="w-52 h-52 flex items-center justify-center text-xs" style={{ color: COLORS.slate }}>Gerando QR Code...</div>}

            <button onClick={copiar} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold w-full justify-center" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
              <Copy size={13} /> {copiado ? "Copiado!" : "Copiar código Pix"}
            </button>

            {whats && (
              <a href={whats} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold w-full justify-center" style={{ background: "#25D366", color: "#fff" }}>
                <MessageCircle size={13} /> Enviar no WhatsApp
              </a>
            )}

            <p className="text-xs text-center mt-1" style={{ color: COLORS.slate }}>
              Pix estático não confirma pagamento sozinho — marque como "Pago" ou importe o extrato quando cair na conta.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
