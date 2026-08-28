import React, { useState } from "react";
import Card from "./Card.jsx";
import PoliticaPrivacidadeModal from "./PoliticaPrivacidadeModal.jsx";
import { COLORS } from "../lib/theme.js";
import { supabase } from "../lib/supabaseClient.js";

// Empresa criada ANTES dessa feature existir (ex.: Gimenes e Pires) nunca passou pela tela
// de cadastro com o checkbox de aceite — esse gate cobre isso: bloqueia o app até o
// admin/sócio aceitar (RLS de organizations só deixa admin/sócio dar update mesmo, os outros
// cargos só veem a mensagem de aviso e saem).
export default function AceitarTermosGate({ profile, currentRole, signOut, onAceito }) {
  const [aceitando, setAceitando] = useState(false);
  const [erro, setErro] = useState("");
  const [mostrarPrivacidade, setMostrarPrivacidade] = useState(false);
  const podeAceitar = currentRole === "admin" || currentRole === "socio";

  const aceitar = async () => {
    setAceitando(true);
    setErro("");
    const { error } = await supabase.from("organizations")
      .update({ termos_aceite: true, termos_aceite_em: new Date().toISOString() })
      .eq("id", profile.org_id);
    setAceitando(false);
    if (error) return setErro(error.message);
    onAceito();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif" }}>
      <Card className="w-full max-w-sm text-center">
        <p style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600, fontSize: 18 }}>
          Termos de Uso e Privacidade
        </p>
        {podeAceitar ? (
          <>
            <p className="text-sm mt-3" style={{ color: COLORS.slate }}>
              Antes de continuar, sua empresa precisa aceitar os Termos de Uso e a{" "}
              <button onClick={() => setMostrarPrivacidade(true)} className="underline" style={{ color: COLORS.brassText }}>
                Política de Privacidade
              </button>{" "}
              do Actum.
            </p>
            {erro && <p className="text-xs mt-2" style={{ color: COLORS.wine }}>{erro}</p>}
            <button onClick={aceitar} disabled={aceitando} className="mt-4 px-4 py-2.5 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: aceitando ? 0.6 : 1 }}>
              {aceitando ? "Salvando..." : "Li e aceito"}
            </button>
          </>
        ) : (
          <p className="text-sm mt-3" style={{ color: COLORS.slate }}>
            Um administrador ou sócio da sua empresa precisa aceitar os Termos de Uso antes de continuar. Peça pra ele entrar e confirmar.
          </p>
        )}
        <button onClick={signOut} className="block mx-auto mt-4 text-xs underline" style={{ color: COLORS.slate }}>Sair</button>
      </Card>
      {mostrarPrivacidade && <PoliticaPrivacidadeModal onClose={() => setMostrarPrivacidade(false)} />}
    </div>
  );
}
