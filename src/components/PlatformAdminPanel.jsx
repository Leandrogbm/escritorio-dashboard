import React, { useEffect, useState } from "react";
import { Building2, LogOut, LayoutGrid } from "lucide-react";
import Card from "./Card.jsx";
import { COLORS } from "../lib/theme.js";
import { supabase } from "../lib/supabaseClient.js";

// Painel do dono da plataforma (mysaldo) — só métricas agregadas por empresa cliente
// (via RPC platform_org_metrics, security definer). Nunca lista clientes internos,
// financeiro ou membros de equipe de cada empresa — só contagens.
export default function PlatformAdminPanel({ temPerfilProprio, onEntrarNaEmpresa, signOut }) {
  const [empresas, setEmpresas] = useState(null);

  useEffect(() => {
    supabase.rpc("platform_org_metrics").then(({ data }) => setEmpresas(data ?? []));
  }, []);

  return (
    <div className="min-h-screen w-full" style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif" }}>
      <header className="flex items-center justify-between px-8 py-4" style={{ background: COLORS.paperRaised, borderBottom: `1px solid ${COLORS.line}` }}>
        <div className="flex items-center gap-2" style={{ color: COLORS.slate }}>
          <LayoutGrid size={16} />
          <span className="text-sm">mysaldo — painel da plataforma</span>
        </div>
        <div className="flex items-center gap-3">
          {temPerfilProprio && (
            <button onClick={onEntrarNaEmpresa} className="text-sm underline" style={{ color: COLORS.slate }}>
              Ver minha empresa
            </button>
          )}
          <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.slate }}>
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>

      <main className="px-8 py-8">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={20} color={COLORS.brass} />
          <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 22, color: COLORS.ink }}>Empresas cadastradas</p>
        </div>
        <p className="text-sm mb-6" style={{ color: COLORS.slate }}>{empresas?.length ?? 0} empresa(s) — só contagens, sem acesso aos dados internos de cada uma.</p>

        <Card className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: COLORS.ink }}>
                {["Empresa", "CNPJ", "Cadastro", "Colaboradores", "Clientes", "Processos"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empresas?.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>Nenhuma empresa cadastrada ainda.</td></tr>
              )}
              {(empresas ?? []).map((e, i) => (
                <tr key={e.org_id} style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
                  <td className="px-4 py-3" style={{ color: COLORS.ink, fontWeight: 600 }}>{e.nome}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.slate }}>{e.cnpj ?? "—"}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.slate }}>{new Date(e.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.ink }}>{e.colaboradores}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.ink }}>{e.clientes}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.ink }}>{e.processos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>
    </div>
  );
}
