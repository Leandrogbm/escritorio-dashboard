import React, { useEffect, useRef, useState } from "react";
import Card from "./Card.jsx";
import PoliticaPrivacidadeModal from "./PoliticaPrivacidadeModal.jsx";
import { AuthField, AuthTabs } from "./AuthKit.jsx";
import { COLORS } from "../lib/theme.js";
import { supabase } from "../lib/supabaseClient.js";
import { formatCpfOuCnpj } from "../lib/documento.js";

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

function carregarTurnstile() {
  if (window.turnstile) return Promise.resolve();
  const existente = document.querySelector(`script[src^="${TURNSTILE_SRC}"]`);
  if (existente) return new Promise((resolve) => existente.addEventListener("load", () => resolve()));
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
}

// Cadastro self-service de uma empresa nova (organization + admin) via Edge Function
// signup-empresa. Sem cobrança nesse momento — toda org nova entra no plano 'gratis' (trial
// por uso, ver signup-empresa); assinar um plano pago é feito depois em Minha Empresa. Depois
// de criar, loga automaticamente com o email/senha informados — App.jsx assume a partir daí.
export default function Signup({ onCancel }) {
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [mostrarPrivacidade, setMostrarPrivacidade] = useState(false);
  // Turnstile (Cloudflare) — evita criação de conta em massa/automatizada. Verificado de
  // verdade dentro da Edge Function signup-empresa (o CAPTCHA nativo do Supabase Auth não
  // adianta aqui: signup-empresa usa a Admin API/service role, não o signUp padrão do
  // GoTrue, então o gate nativo deles nunca é acionado).
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !turnstileRef.current) return;
    let widgetId;
    let cancelado = false;
    carregarTurnstile().then(() => {
      if (cancelado || !turnstileRef.current) return;
      widgetId = window.turnstile.render(turnstileRef.current, {
        sitekey: siteKey,
        action: "signup",
        callback: (token) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(""),
      });
    });
    return () => { cancelado = true; if (widgetId) window.turnstile?.remove(widgetId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError("As senhas não coincidem.");
    if (!termosAceitos) return setError("Você precisa aceitar os Termos de Uso e a Política de Privacidade pra continuar.");
    if (siteKey && !captchaToken) return setError("Confirma que você não é um robô pra continuar.");
    setError("");
    setLoading(true);
    const { error: signupError } = await supabase.functions.invoke("signup-empresa", {
      body: { nomeEmpresa, cnpj, nomeResponsavel, email, password, termosAceitos: true, captchaToken },
    });
    if (signupError) {
      const body = await signupError.context?.json?.().catch(() => null);
      setError(body?.error ?? signupError.message);
      setLoading(false);
      window.turnstile?.reset();
      setCaptchaToken("");
      return;
    }
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (loginError) { setError("Empresa criada — faça login normalmente."); onCancel(); return; }
    // Sessão criada: App.jsx já sai da tela de login/cadastro sozinho assim que `session` muda.
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif" }}>
      <Card className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-1 mb-5">
          <img src="/brand/logo-icon.png" alt="Actum" className="w-9 h-9 mb-2" />
          <p style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600, fontSize: 22 }}>
            Cadastrar empresa
          </p>
          <p className="text-xs mb-3 text-center" style={{ color: COLORS.slate }}>
            Crie o acesso do seu escritório no Actum — grátis pra até 2 clientes, 2 processos e 2 usuários, sem cartão.
          </p>
          <AuthTabs active="signup" onLogin={onCancel} onSignup={() => {}} />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <AuthField id="signup-empresa" label="Nome da empresa" required value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} />
          <AuthField id="signup-cnpj" label="CPF ou CNPJ" required inputMode="numeric" maxLength={18} value={cnpj} onChange={(e) => setCnpj(formatCpfOuCnpj(e.target.value))} />
          <AuthField id="signup-responsavel" label="Responsável (admin)" required value={nomeResponsavel} onChange={(e) => setNomeResponsavel(e.target.value)} />
          <AuthField id="signup-email" label="Email corporativo" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <AuthField id="signup-senha" label="Senha" required type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <AuthField id="signup-confirmar" label="Confirmar senha" required type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>

          <label className="flex items-start gap-2 text-xs" style={{ color: COLORS.slate }}>
            <input type="checkbox" checked={termosAceitos} onChange={(e) => setTermosAceitos(e.target.checked)} className="mt-0.5 shrink-0" />
            <span>
              Li e aceito os{" "}
              <button type="button" onClick={() => setMostrarPrivacidade(true)} className="underline" style={{ color: COLORS.brassText }}>
                Termos de Uso e a Política de Privacidade
              </button>{" "}
              do Actum.
            </span>
          </label>

          {siteKey && <div ref={turnstileRef} />}

          {error && <p className="text-xs" style={{ color: COLORS.wine }}>{error}</p>}

          <button type="submit" disabled={loading}
            className="mt-1 px-3.5 py-2.5 rounded-md text-sm font-semibold"
            style={{ background: COLORS.brass, color: COLORS.ink, opacity: loading ? 0.6 : 1 }}>
            {loading ? "Criando..." : "Criar empresa"}
          </button>
        </form>
      </Card>
      {mostrarPrivacidade && <PoliticaPrivacidadeModal onClose={() => setMostrarPrivacidade(false)} />}
    </div>
  );
}
