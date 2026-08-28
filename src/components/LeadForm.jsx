import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { supabase } from "../lib/supabaseClient.js";

const AREAS = [
  { value: "trabalhista", label: "Trabalhista" },
  { value: "familia", label: "Família" },
  { value: "tributario", label: "Tributário" },
  { value: "civel", label: "Cível" },
  { value: "penal", label: "Penal" },
  { value: "empresarial", label: "Empresarial" },
];

// Só confere que tem dígito suficiente pra ser telefone (8 a 11 dígitos, com ou sem DDD/9) —
// não valida DDD real nem formato exato, é só pra pegar erro de digitação grosseiro.
function telefoneValido(v) {
  return (v.replace(/\D/g, "").length) >= 8;
}

// Formulário público de captação — embutido via <iframe> no site do escritório (fora deste
// painel, sem autenticação). orgId vem da URL (?org=...) que o escritório usa no embed —
// não é segredo, só identifica qual empresa recebe o lead.
export default function LeadForm({ orgId }) {
  const [areaDireito, setAreaDireito] = useState("");
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [cidade, setCidade] = useState("");
  const [coords, setCoords] = useState(null); // {latitude, longitude} | null
  const [localizando, setLocalizando] = useState(false);
  const [consentimento, setConsentimento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  const usarLocalizacao = () => {
    if (!navigator.geolocation) return;
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setLocalizando(false); },
      () => setLocalizando(false),
      { timeout: 8000 }
    );
  };

  const enviar = async (e) => {
    e.preventDefault();
    setErro("");
    if (!areaDireito) return setErro("Escolha a área do direito.");
    if (!nome.trim()) return setErro("Informe seu nome.");
    if (!telefoneValido(contato)) return setErro("Informe um telefone/WhatsApp válido.");
    if (!consentimento) return setErro("É preciso autorizar o contato pra enviar.");

    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("leads-captacao-publico", {
      body: {
        orgId, nome, contato, areaDireito, cidade,
        latitude: coords?.latitude, longitude: coords?.longitude,
        consentimentoLgpd: consentimento,
      },
    });
    setEnviando(false);
    if (error) {
      setErro((await error.context?.json?.().catch(() => null))?.error ?? "Não consegui enviar. Tenta de novo.");
      return;
    }
    setEnviado(true);
  };

  if (!orgId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: COLORS.paper }}>
        <p className="text-sm" style={{ color: COLORS.wine }}>Formulário mal configurado — falta identificar a empresa.</p>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif" }}>
        <div className="text-center max-w-sm">
          <CheckCircle2 size={40} color={COLORS.success} className="mx-auto mb-3" />
          <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 18, color: COLORS.ink }}>Recebemos seu contato</p>
          <p className="text-sm mt-2" style={{ color: COLORS.slate }}>Nossa equipe vai entrar em contato em breve.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif" }}>
      <form onSubmit={enviar} className="w-full max-w-sm flex flex-col gap-3 p-6 rounded-lg" style={{ background: "#fff", border: `1px solid ${COLORS.line}` }}>
        <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 18, color: COLORS.ink }}>Fale com o escritório</p>
        <p className="text-xs -mt-2" style={{ color: COLORS.slate }}>Preencha seus dados que entramos em contato.</p>

        <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.ink, fontWeight: 600 }}>
          Área do direito
          <select value={areaDireito} onChange={(e) => setAreaDireito(e.target.value)} className="px-3 py-2 rounded-md text-sm font-normal" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
            <option value="">Selecione...</option>
            {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.ink, fontWeight: 600 }}>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="px-3 py-2 rounded-md text-sm font-normal" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }} />
        </label>

        <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.ink, fontWeight: 600 }}>
          Telefone / WhatsApp
          <input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="(11) 91234-5678" className="px-3 py-2 rounded-md text-sm font-normal" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }} />
        </label>

        <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.ink, fontWeight: 600 }}>
          Cidade
          <div className="flex items-center gap-2">
            <input value={cidade} onChange={(e) => setCidade(e.target.value)} className="flex-1 px-3 py-2 rounded-md text-sm font-normal" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }} />
            <button type="button" onClick={usarLocalizacao} disabled={localizando} className="shrink-0 px-2.5 py-2 rounded-md text-xs font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.brassText }}>
              {localizando ? "..." : coords ? "✓ Local" : "Usar local"}
            </button>
          </div>
        </label>

        <label className="flex items-start gap-2 text-xs mt-1" style={{ color: COLORS.slate }}>
          <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} className="mt-0.5" />
          Autorizo o escritório a entrar em contato sobre o assunto informado, conforme sua política de privacidade.
        </label>

        {erro && <p className="text-xs" style={{ color: COLORS.wine }}>{erro}</p>}

        <button type="submit" disabled={enviando} className="mt-1 px-3.5 py-2.5 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: enviando ? 0.6 : 1 }}>
          {enviando ? "Enviando..." : "Enviar"}
        </button>
      </form>
    </div>
  );
}
