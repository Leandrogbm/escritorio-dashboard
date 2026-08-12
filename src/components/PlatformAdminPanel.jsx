import React, { useEffect, useState } from "react";
import { Building2, LogOut, LayoutGrid, Eye } from "lucide-react";
import Card from "./Card.jsx";
import RecordFormModal from "./RecordFormModal.jsx";
import EmpresaInspector from "./EmpresaInspector.jsx";
import { COLORS } from "../lib/theme.js";
import { BRL } from "../data/mockData.js";
import { supabase } from "../lib/supabaseClient.js";

const STATUS_TONE = { pago: COLORS.success, pendente: COLORS.brass, atrasado: COLORS.wine };
const BILLING_FIELDS = [
  { key: "plano", label: "Plano", optional: true },
  { key: "valor_mensal", label: "Valor mensal (R$)", type: "number", optional: true },
  { key: "status_pagamento", label: "Situação", type: "select", options: [
    { value: "pago", label: "Pago" }, { value: "pendente", label: "Pendente" }, { value: "atrasado", label: "Atrasado" },
  ] },
];

// Painel do dono da plataforma (mysaldo) — métricas agregadas por empresa cliente (via RPC
// platform_org_metrics, security definer) + billing que a empresa paga PRA plataforma
// (diferente do financeiro interno dela). "Inspecionar" abre acesso de suporte somente-leitura.
export default function PlatformAdminPanel({ temPerfilProprio, onEntrarNaEmpresa, signOut }) {
  const [empresas, setEmpresas] = useState(null);
  const [editingBilling, setEditingBilling] = useState(null); // {...} = editando billing de uma empresa
  const [inspecting, setInspecting] = useState(null); // {org_id, nome} = inspetor aberto

  const carregar = () => supabase.rpc("platform_org_metrics").then(({ data }) => setEmpresas(data ?? []));
  useEffect(() => { carregar(); }, []);

  const salvarBilling = async (values) => {
    const { error } = await supabase.from("organizations").update(values).eq("id", editingBilling.org_id);
    if (error) throw error;
    await carregar();
  };

  const mrr = (empresas ?? []).reduce((s, e) => s + (e.status_pagamento !== "atrasado" ? Number(e.valor_mensal || 0) : 0), 0);
  const atrasadas = (empresas ?? []).filter((e) => e.status_pagamento === "atrasado").length;

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
        <p className="text-sm mb-6" style={{ color: COLORS.slate }}>{empresas?.length ?? 0} empresa(s).</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>MRR (em dia)</p>
            <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.ink }}>{BRL(mrr)}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Empresas atrasadas</p>
            <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.wine }}>{atrasadas}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Total de empresas</p>
            <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.ink }}>{empresas?.length ?? 0}</p>
          </Card>
        </div>

        <Card className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: COLORS.ink }}>
                {["Empresa", "CNPJ", "Cadastro", "Colab.", "Clientes", "Processos", "Plano", "Mensalidade", "Situação", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empresas?.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>Nenhuma empresa cadastrada ainda.</td></tr>
              )}
              {(empresas ?? []).map((e, i) => (
                <tr key={e.org_id} style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
                  <td className="px-4 py-3" style={{ color: COLORS.ink, fontWeight: 600 }}>{e.nome}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.slate }}>{e.cnpj ?? "—"}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.slate }}>{new Date(e.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.ink }}>{e.colaboradores}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.ink }}>{e.clientes}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.ink }}>{e.processos}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.slate }}>{e.plano || "—"}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.ink }}>{e.valor_mensal ? BRL(e.valor_mensal) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold uppercase" style={{ color: STATUS_TONE[e.status_pagamento] }}>{e.status_pagamento}</span>
                  </td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <button onClick={() => setInspecting(e)} aria-label="Inspecionar" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.slate }}>
                      <Eye size={14} />
                    </button>
                    <button onClick={() => setEditingBilling(e)} className="text-xs underline" style={{ color: COLORS.slate }}>billing</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>

      <RecordFormModal
        open={editingBilling !== null}
        title={`Billing — ${editingBilling?.nome ?? ""}`}
        fields={BILLING_FIELDS}
        initialValues={editingBilling}
        onClose={() => setEditingBilling(null)}
        onSubmit={salvarBilling}
      />

      {inspecting && (
        <EmpresaInspector orgId={inspecting.org_id} orgNome={inspecting.nome} onClose={() => setInspecting(null)} />
      )}
    </div>
  );
}
