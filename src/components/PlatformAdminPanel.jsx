import React, { useEffect, useState } from "react";
import { Building2, LogOut, LayoutGrid, Eye, Ban, PlayCircle, Trash2, Settings2, XCircle, ShieldAlert } from "lucide-react";
import Card from "./Card.jsx";
import RecordFormModal from "./RecordFormModal.jsx";
import EmpresaInspector from "./EmpresaInspector.jsx";
import { COLORS } from "../lib/theme.js";
import { BRL } from "../data/mockData.js";
import { supabase } from "../lib/supabaseClient.js";

const STATUS_TONE = { pago: COLORS.success, pendente: COLORS.brass, atrasado: COLORS.wine };
// Espelha a tabela plan_limits — só pra UX (auto-preencher valor_mensal e mostrar o preço
// na lista). O limite de verdade é aplicado no banco (RLS de processos, Edge Function de
// criar colaborador), não aqui; mudar aqui sem mudar lá só desalinha o texto da tela.
const PLANOS = [
  { value: "basic", label: "Basic — R$100/mês (5 usuários, 50 processos)", valor: 100 },
  { value: "intermediario", label: "Intermediário — R$300/mês (15 usuários, 200 processos)", valor: 300 },
  { value: "plus", label: "Plus — R$500/mês (ilimitado)", valor: 500 },
];
const CONFIG_FIELDS = [
  { key: "nome", label: "Nome da empresa" },
  { key: "cnpj", label: "CNPJ", optional: true },
  {
    key: "plano", label: "Plano", type: "select", optional: true, options: PLANOS,
    onSelect: (value) => ({ valor_mensal: PLANOS.find((p) => p.value === value)?.valor }),
  },
  { key: "valor_mensal", label: "Valor mensal (R$)", type: "number", optional: true },
  { key: "status_pagamento", label: "Situação de pagamento", type: "select", options: [
    { value: "pago", label: "Pago" }, { value: "pendente", label: "Pendente" }, { value: "atrasado", label: "Atrasado" },
  ] },
];

// Painel do dono da plataforma (mysaldo) — métricas agregadas por empresa cliente (via RPC
// platform_org_metrics, security definer) + billing que a empresa paga PRA plataforma
// (diferente do financeiro interno dela). "Inspecionar" abre acesso de suporte somente-leitura.
export default function PlatformAdminPanel({ temPerfilProprio, onEntrarNaEmpresa, onEntrarComoAdmin, signOut }) {
  const [empresas, setEmpresas] = useState(null);
  const [editingConfig, setEditingConfig] = useState(null); // {...} = configurando uma empresa
  const [inspecting, setInspecting] = useState(null); // {org_id, nome} = inspetor aberto

  const carregar = () => supabase.rpc("platform_org_metrics").then(({ data }) => setEmpresas(data ?? []));
  useEffect(() => { carregar(); }, []);

  const salvarConfig = async (values) => {
    const { error } = await supabase.from("organizations").update(values).eq("id", editingConfig.org_id);
    if (error) throw error;
    await carregar();
  };

  const alternarSuspensao = async (empresa) => {
    const acao = empresa.suspenso ? "reativar" : "suspender";
    if (!confirm(`Confirma ${acao} o acesso de "${empresa.nome}"?`)) return;
    const { error } = await supabase.from("organizations").update({ suspenso: !empresa.suspenso }).eq("id", empresa.org_id);
    if (error) return alert(error.message);
    await carregar();
  };

  const cancelarPlano = async (empresa) => {
    if (!empresa.plano) return;
    if (!confirm(`Cancelar o plano de "${empresa.nome}"? Ela fica sem plano (não é o mesmo que suspender o acesso).`)) return;
    const { error } = await supabase.from("organizations").update({ plano: null }).eq("id", empresa.org_id);
    if (error) return alert(error.message);
    await carregar();
  };

  const excluirEmpresa = async (empresa) => {
    const digitado = prompt(`Isso apaga TUDO de "${empresa.nome}" (colaboradores, clientes, processos, financeiro) sem volta.\n\nDigite o nome exato da empresa pra confirmar:`);
    if (digitado === null) return;
    if (digitado !== empresa.nome) return alert("Nome não confere — nada foi excluído.");
    const { error } = await supabase.functions.invoke("platform-delete-org", { body: { orgId: empresa.org_id, confirmarNome: digitado } });
    if (error) {
      const body = await error.context?.json?.().catch(() => null);
      alert(body?.error ?? error.message);
      return;
    }
    await carregar();
  };

  const mrr = (empresas ?? []).reduce((s, e) => s + (e.status_pagamento !== "atrasado" ? Number(e.valor_mensal || 0) : 0), 0);
  const atrasadas = (empresas ?? []).filter((e) => e.status_pagamento === "atrasado").length;

  return (
    <div className="min-h-screen w-full" style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif" }}>
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-8 py-4" style={{ background: COLORS.paperRaised, borderBottom: `1px solid ${COLORS.line}` }}>
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

      <main className="px-4 sm:px-8 py-6 sm:py-8">
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
          <div className="overflow-x-auto">
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
                  <td className="px-4 py-3" style={{ color: COLORS.slate }}>{PLANOS.find((p) => p.value === e.plano)?.label.split(" —")[0] ?? e.plano ?? "—"}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.ink }}>{e.valor_mensal ? BRL(e.valor_mensal) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold uppercase" style={{ color: STATUS_TONE[e.status_pagamento] }}>{e.status_pagamento}</span>
                    {e.suspenso && <span className="ml-2 text-xs font-semibold uppercase" style={{ color: COLORS.wine }}>· suspensa</span>}
                  </td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <button
                      onClick={() => { if (confirm(`Entrar em "${e.nome}" como se fosse o admin de lá? Você vai poder criar/editar/excluir tudo — cliente, processo, financeiro, equipe. Fica registrado no log de auditoria.`)) onEntrarComoAdmin(e); }}
                      aria-label="Entrar como admin"
                      title="Entrar como admin"
                      className="p-1.5 rounded hover:opacity-70"
                      style={{ color: COLORS.wine }}
                    >
                      <ShieldAlert size={14} />
                    </button>
                    <button onClick={() => setInspecting(e)} aria-label="Inspecionar (somente leitura)" title="Inspecionar (somente leitura)" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.slate }}>
                      <Eye size={14} />
                    </button>
                    <button onClick={() => setEditingConfig(e)} aria-label="Configurar" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.slate }}>
                      <Settings2 size={14} />
                    </button>
                    <button onClick={() => alternarSuspensao(e)} aria-label={e.suspenso ? "Reativar" : "Suspender"} className="p-1.5 rounded hover:opacity-70" style={{ color: e.suspenso ? COLORS.success : COLORS.brass }}>
                      {e.suspenso ? <PlayCircle size={14} /> : <Ban size={14} />}
                    </button>
                    {e.plano && (
                      <button onClick={() => cancelarPlano(e)} aria-label="Cancelar plano" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.wine }}>
                        <XCircle size={14} />
                      </button>
                    )}
                    <button onClick={() => excluirEmpresa(e)} aria-label="Excluir empresa" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.wine }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      </main>

      <RecordFormModal
        open={editingConfig !== null}
        title={`Configurar — ${editingConfig?.nome ?? ""}`}
        fields={CONFIG_FIELDS}
        initialValues={editingConfig}
        onClose={() => setEditingConfig(null)}
        onSubmit={salvarConfig}
      />

      {inspecting && (
        <EmpresaInspector orgId={inspecting.org_id} orgNome={inspecting.nome} onClose={() => setInspecting(null)} />
      )}
    </div>
  );
}
