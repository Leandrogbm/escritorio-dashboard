import React from "react";
import { X, Shield } from "lucide-react";
import Card from "./Card.jsx";
import { COLORS } from "../lib/theme.js";
import { useEscClose } from "../hooks/useEscClose.js";

// Texto GENÉRICO/modelo, escrito pra fazer sentido pra um escritório de advocacia — não
// substitui revisão jurídica de verdade (o próprio escritório é quem tem essa expertise).
// Principalmente o item "Encarregado (DPO)" precisa de um nome/contato real antes de valer
// como documento oficial — deixei como placeholder de propósito, não inventei um contato.
const SECOES = [
  {
    titulo: "1. Quem trata seus dados",
    texto: `Os dados pessoais tratados nesta plataforma são de responsabilidade do escritório contratante (o "Controlador"), que utiliza o Actum como ferramenta de gestão. O Actum atua como operador desses dados, seguindo as instruções do escritório.`,
  },
  {
    titulo: "2. Quais dados coletamos",
    texto: `Nome, CPF ou CNPJ, endereço, telefone, e-mail, dados processuais (número, área, andamentos, valores de causa) e financeiros (honorários, cobranças) — sempre relacionados ao serviço jurídico prestado.`,
  },
  {
    titulo: "3. Para que usamos",
    texto: `Gestão de processos e prazos, comunicação sobre o andamento do caso, cobrança de honorários e cumprimento de obrigações legais e contratuais do escritório. Não usamos os dados para fins de marketing sem autorização específica.`,
  },
  {
    titulo: "4. Base legal",
    texto: `Execução de contrato (prestação do serviço jurídico contratado), cumprimento de obrigação legal ou regulatória, e consentimento do titular quando aplicável (art. 7º da Lei 13.709/2018 — LGPD).`,
  },
  {
    titulo: "5. Por quanto tempo guardamos",
    texto: `Pelo tempo necessário à prestação do serviço e pelos prazos de guarda exigidos por lei (prescricionais, fiscais e do Estatuto da OAB/Código de Ética), mesmo após o fim do contrato.`,
  },
  {
    titulo: "6. Seus direitos",
    texto: `Confirmação de tratamento, acesso, correção de dados incompletos ou desatualizados, anonimização/eliminação de dados desnecessários, portabilidade e revogação do consentimento — sempre respeitando prazos legais de guarda de documentos jurídicos, que podem impedir a exclusão imediata de alguns dados.`,
  },
  {
    titulo: "7. Como exercer seus direitos",
    texto: `Entre em contato diretamente com o escritório responsável pelo seu caso, pelos canais de contato já utilizados na prestação do serviço.`,
  },
  {
    titulo: "8. Segurança",
    texto: `Os dados ficam armazenados com controle de acesso por perfil (cada colaborador só vê o que precisa pra função), conexão criptografada e infraestrutura com práticas de segurança de mercado (Supabase/AWS).`,
  },
];

export default function PoliticaPrivacidadeModal({ onClose }) {
  useEscClose(onClose, true);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,35,59,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card style={{ boxShadow: "0 20px 48px rgba(22,35,59,0.22)" }}>
          <div className="flex items-center justify-between mb-1">
            <p className="flex items-center gap-2" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 18, color: COLORS.ink }}>
              <Shield size={18} color={COLORS.brass} /> Política de Privacidade
            </p>
            <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
          </div>
          <p className="text-xs mb-4" style={{ color: COLORS.slate }}>
            Como tratamos dados pessoais nesta plataforma, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).
          </p>
          <div className="flex flex-col gap-4">
            {SECOES.map((s) => (
              <div key={s.titulo}>
                <p className="text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>{s.titulo}</p>
                <p className="text-sm" style={{ color: COLORS.slate }}>{s.texto}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
