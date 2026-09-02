import React, { useState } from "react";
import { Fingerprint } from "lucide-react";
import Card from "./Card.jsx";
import { COLORS } from "../lib/theme.js";
import { supabase } from "../lib/supabaseClient.js";

// Mostrado uma vez, logo depois de um login com e-mail/senha bem-sucedido (nunca depois de
// já ter entrado com biometria) — oferece registrar Face ID/digital/Windows Hello nesse
// dispositivo pra próxima vez. Não é um botão de configuração solto no header: é parte do
// momento de login, por pedido explícito do usuário.
export default function BiometriaPrompt({ onFechar }) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const ativar = async () => {
    setLoading(true);
    const { error } = await supabase.auth.registerPasskey();
    setLoading(false);
    if (error) return setErro("Não deu pra ativar: " + error.message);
    onFechar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,35,59,0.4)" }}>
      <Card className="w-full max-w-sm" style={{ boxShadow: "0 20px 48px rgba(22,35,59,0.22)" }}>
        <div className="flex flex-col items-center gap-2 text-center mb-4">
          <Fingerprint size={28} color={COLORS.brass} />
          <p style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600, fontSize: 17 }}>
            Ativar login por biometria?
          </p>
          <p className="text-sm" style={{ color: COLORS.slate }}>
            Face ID, digital ou Windows Hello — só nesse dispositivo, sem digitar senha da próxima vez.
          </p>
        </div>
        {erro && <p className="text-xs mb-3 text-center" style={{ color: COLORS.wine }}>{erro}</p>}
        <div className="flex gap-2">
          <button
            onClick={onFechar}
            className="flex-1 px-3.5 py-2.5 rounded-md text-sm"
            style={{ border: `1px solid ${COLORS.line}`, color: COLORS.slate }}
          >
            Agora não
          </button>
          <button
            onClick={ativar}
            disabled={loading}
            className="flex-1 px-3.5 py-2.5 rounded-md text-sm font-semibold"
            style={{ background: COLORS.ink, color: "#fff", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Ativando..." : "Ativar"}
          </button>
        </div>
      </Card>
    </div>
  );
}
