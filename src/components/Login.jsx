import React, { useState } from "react";
import Card from "./Card.jsx";
import Signup from "./Signup.jsx";
import { COLORS } from "../lib/theme.js";
import { supabase } from "../lib/supabaseClient.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false); // true = mostra o form de "esqueci minha senha"
  const [sent, setSent] = useState(false);
  const [signingUp, setSigningUp] = useState(false); // true = mostra o cadastro de empresa nova

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) setError("E-mail ou senha inválidos.");
  };

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
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif" }}>
        <Card className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-2 mb-6">
            <img src="/brand/logo-icon.png" alt="Actum" className="w-9 h-9" />
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
              <input
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
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif" }}>
      <Card className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-6">
          <img src="/brand/logo-icon.png" alt="Actum" className="w-9 h-9" />
          <p style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600, fontSize: 18 }}>
            Actum
          </p>
          <p className="text-xs" style={{ color: COLORS.slate }}>Acesse com seu e-mail e senha</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-3.5 py-2.5 rounded-md text-sm outline-none"
            style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, background: COLORS.paperRaised }}
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            {loading ? "Entrando..." : "Entrar"}
          </button>

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
      </Card>
    </div>
  );
}
