import React, { useState } from "react";
import { Eye, EyeOff, Scale, Fingerprint } from "lucide-react";
import Card from "./Card.jsx";
import Signup from "./Signup.jsx";
import PoliticaPrivacidadeModal from "./PoliticaPrivacidadeModal.jsx";
import { COLORS } from "../lib/theme.js";
import { supabase } from "../lib/supabaseClient.js";

// Moldura da tela de login/recuperação — painel de marca (ink navy) à esquerda em telas
// largas, formulário à direita. Só layout/visual em volta do `children`; nenhum dos dois
// formulários muda de comportamento por causa disso, só ganham uma vitrine em telas grandes.
function AuthShell({ children }) {
  return (
    <div className="min-h-screen w-full flex" style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif" }}>
      <div
        className="hidden lg:flex flex-col justify-between w-[42%] shrink-0 px-12 py-14 relative overflow-hidden"
        style={{ background: COLORS.ink }}
      >
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <img src="/brand/logo-icon.png" alt="Actum" className="w-9 h-9" />
          <span style={{ fontFamily: "'Source Serif 4', serif", color: "#fff", fontWeight: 600, fontSize: 20 }}>Actum</span>
        </div>
        <div className="relative">
          <Scale size={34} color={COLORS.brass} className="mb-5" />
          <p style={{ fontFamily: "'Source Serif 4', serif", color: "#fff", fontWeight: 600, fontSize: 30, lineHeight: 1.25 }}>
            Gestão jurídica e ERP,<br />num só lugar.
          </p>
          <p className="text-sm mt-3 max-w-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            Processos, prazos, financeiro e equipe do escritório — organizados com o rigor que a advocacia exige.
          </p>
        </div>
        <p className="relative text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>© {new Date().getFullYear()} Actum</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false); // true = mostra o form de "esqueci minha senha"
  const [verSenha, setVerSenha] = useState(false);
  const [sent, setSent] = useState(false);
  const [signingUp, setSigningUp] = useState(false); // true = mostra o cadastro de empresa nova
  const [mostrarPrivacidade, setMostrarPrivacidade] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) setError("E-mail ou senha inválidos.");
  };

  const handlePasskeyLogin = async () => {
    setError("");
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPasskey();
    setLoading(false);
    if (authError) setError("Não foi possível entrar com biometria. Use e-mail e senha, ou ative a biometria depois de logar.");
  };

  // WebAuthn não existe em todo navegador/contexto (exige HTTPS) — só mostra o botão quando dá.
  const suportaPasskey = typeof window !== "undefined" && !!window.PublicKeyCredential;

  const handleForgot = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    // redirectTo não é usado — o template de recovery no Supabase já aponta pro app
    // via {{ .SiteURL }}/?token_hash=...&type=recovery (ver useAuth.js).
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (resetError) setError(resetError.message);
    else setSent(true);
  };

  if (signingUp) {
    return <Signup onDone={() => setSigningUp(false)} onCancel={() => setSigningUp(false)} />;
  }

  if (forgot) {
    return (
      <AuthShell>
        <Card className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-2 mb-6">
            <img src="/brand/logo-icon.png" alt="Actum" className="w-9 h-9 lg:hidden" />
            <p style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600, fontSize: 18 }}>
              Redefinir senha
            </p>
          </div>

          {sent ? (
            <p className="text-sm text-center" style={{ color: COLORS.slate }}>
              Se esse e-mail estiver cadastrado, mandamos um link pra redefinir a senha.
            </p>
          ) : (
            <form onSubmit={handleForgot} className="flex flex-col gap-3">
              <label htmlFor="forgot-email" className="sr-only">Seu e-mail</label>
              <input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-3.5 py-2.5 rounded-md text-sm outline-none"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, background: COLORS.paperRaised }}
              />
              {error && <p className="text-xs" style={{ color: COLORS.wine }}>{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 px-3.5 py-2.5 rounded-md text-sm font-semibold"
                style={{ background: COLORS.ink, color: "#fff", opacity: loading ? 0.6 : 1 }}
              >
                {loading ? "Enviando..." : "Enviar link"}
              </button>
            </form>
          )}

          <button
            onClick={() => { setForgot(false); setSent(false); setError(""); }}
            className="text-xs mt-5 block mx-auto underline"
            style={{ color: COLORS.slate }}
          >
            Voltar ao login
          </button>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-6">
          <img src="/brand/logo-icon.png" alt="Actum" className="w-9 h-9 lg:hidden" />
          <p style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600, fontSize: 18 }}>
            Actum
          </p>
          <p className="text-xs" style={{ color: COLORS.slate }}>Acesse com seu e-mail e senha</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="login-email" className="sr-only">E-mail</label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-3.5 py-2.5 rounded-md text-sm outline-none"
            style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, background: COLORS.paperRaised }}
          />
          <div className="relative">
            <label htmlFor="login-password" className="sr-only">Senha</label>
            <input
              id="login-password"
              type={verSenha ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 pr-10 rounded-md text-sm outline-none"
              style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, background: COLORS.paperRaised }}
            />
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded hover:opacity-70"
              style={{ color: COLORS.slate }}
            >
              {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && <p className="text-xs" style={{ color: COLORS.wine }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 px-3.5 py-2.5 rounded-md text-sm font-semibold"
            style={{ background: COLORS.ink, color: "#fff", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {suportaPasskey && (
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-md text-sm font-semibold"
              style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
            >
              <Fingerprint size={15} /> Entrar com biometria
            </button>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => { setForgot(true); setError(""); }}
              className="text-xs underline"
              style={{ color: COLORS.slate }}
            >
              Esqueci minha senha
            </button>
            <button
              type="button"
              onClick={() => { setSigningUp(true); setError(""); }}
              className="text-xs underline"
              style={{ color: COLORS.slate }}
            >
              Cadastrar minha empresa
            </button>
          </div>
        </form>

        <p className="text-xs mt-5 text-center" style={{ color: COLORS.slate }}>
          Acesso restrito. Fale com o administrador do seu escritório para receber suas credenciais.
        </p>
        <p className="text-xs mt-2 text-center">
          <button type="button" onClick={() => setMostrarPrivacidade(true)} className="underline" style={{ color: COLORS.slate }}>
            Política de Privacidade
          </button>
        </p>
      </Card>
      {mostrarPrivacidade && <PoliticaPrivacidadeModal onClose={() => setMostrarPrivacidade(false)} />}
    </AuthShell>
  );
}
