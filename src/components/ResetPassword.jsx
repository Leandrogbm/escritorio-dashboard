import React, { useState } from "react";
import { KeyRound } from "lucide-react";
import Card from "./Card.jsx";
import { COLORS } from "../lib/theme.js";
import { supabase } from "../lib/supabaseClient.js";

// Tela mostrada depois que o usuário abre o link do email de "redefinir senha"
// (evento PASSWORD_RECOVERY em useAuth) — troca a senha e libera o acesso normal.
export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError("As senhas não coincidem.");
    if (password.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres.");
    setError("");
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) return setError(updateError.message);
    onDone();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif" }}>
      <Card className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-6">
          <KeyRound size={28} color={COLORS.brass} />
          <p style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600, fontSize: 18 }}>
            Definir nova senha
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="Nova senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-3.5 py-2.5 rounded-md text-sm outline-none"
            style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, background: COLORS.paperRaised }}
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="Confirmar nova senha"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </Card>
    </div>
  );
}
