import React, { useState } from "react";
import Card from "./Card.jsx";
import PoliticaPrivacidadeModal from "./PoliticaPrivacidadeModal.jsx";
import { COLORS } from "../lib/theme.js";
import { supabase } from "../lib/supabaseClient.js";

const FIELD_STYLE = { border: `1px solid ${COLORS.line}`, color: COLORS.ink, background: COLORS.paperRaised };

// Cadastro self-service de uma empresa nova (organization + admin) via Edge Function
// signup-empresa. Depois de criar, loga automaticamente com o email/senha informados.
export default function Signup({ onDone, onCancel }) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError("As senhas não coincidem.");
    if (!termosAceitos) return setError("Você precisa aceitar os Termos de Uso e a Política de Privacidade pra continuar.");
    setError("");
    setLoading(true);
    const { error: signupError } = await supabase.functions.invoke("signup-empresa", {
      body: { nomeEmpresa, cnpj, nomeResponsavel, email, password, termosAceitos: true },
    });
    if (signupError) {
      const body = await signupError.context?.json?.().catch(() => null);
      setError(body?.error ?? signupError.message);
      setLoading(false);
      return;
    }
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (loginError) { setError("Empresa criada — faça login normalmente."); onCancel(); return; }
    onDone();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif" }}>
      <Card className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-6">
          <img src="/brand/logo-icon.png" alt="Actum" className="w-9 h-9" />
          <p style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600, fontSize: 18 }}>
            Cadastrar empresa
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="signup-empresa" className="sr-only">Nome da empresa</label>
          <input id="signup-empresa" required placeholder="Nome da empresa" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)}
            className="px-3.5 py-2.5 rounded-md text-sm outline-none" style={FIELD_STYLE} />
          <label htmlFor="signup-cnpj" className="sr-only">CNPJ</label>
          <input id="signup-cnpj" required placeholder="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)}
            className="px-3.5 py-2.5 rounded-md text-sm outline-none" style={FIELD_STYLE} />
          <label htmlFor="signup-responsavel" className="sr-only">Seu nome (responsável/admin)</label>
          <input id="signup-responsavel" required placeholder="Seu nome (responsável/admin)" value={nomeResponsavel} onChange={(e) => setNomeResponsavel(e.target.value)}
            className="px-3.5 py-2.5 rounded-md text-sm outline-none" style={FIELD_STYLE} />
          <label htmlFor="signup-email" className="sr-only">Email corporativo</label>
          <input id="signup-email" required type="email" autoComplete="email" placeholder="Email corporativo" value={email} onChange={(e) => setEmail(e.target.value)}
            className="px-3.5 py-2.5 rounded-md text-sm outline-none" style={FIELD_STYLE} />
          <label htmlFor="signup-senha" className="sr-only">Senha</label>
          <input id="signup-senha" required type="password" autoComplete="new-password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)}
            className="px-3.5 py-2.5 rounded-md text-sm outline-none" style={FIELD_STYLE} />
          <label htmlFor="signup-confirmar" className="sr-only">Confirmar senha</label>
          <input id="signup-confirmar" required type="password" autoComplete="new-password" placeholder="Confirmar senha" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="px-3.5 py-2.5 rounded-md text-sm outline-none" style={FIELD_STYLE} />

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

          {error && <p className="text-xs" style={{ color: COLORS.wine }}>{error}</p>}

          <button type="submit" disabled={loading}
            className="mt-1 px-3.5 py-2.5 rounded-md text-sm font-semibold"
            style={{ background: COLORS.ink, color: "#fff", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Criando..." : "Criar empresa"}
          </button>

          <button type="button" onClick={onCancel} className="text-xs underline" style={{ color: COLORS.slate }}>
            Já tenho conta — voltar ao login
          </button>
        </form>
      </Card>
      {mostrarPrivacidade && <PoliticaPrivacidadeModal onClose={() => setMostrarPrivacidade(false)} />}
    </div>
  );
}
