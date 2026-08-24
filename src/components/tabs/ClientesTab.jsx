import React, { useMemo, useState } from "react";
import { Users, Plus, MessageCircle, UserCheck, KeyRound } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import RowActions from "../RowActions.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import SearchInput from "../SearchInput.jsx";
import { COLORS } from "../../lib/theme.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
import { supabase } from "../../lib/supabaseClient.js";
import { buscarEnderecoPorCep } from "../../lib/viaCep.js";
import { formatCelular } from "../../lib/celular.js";
import { formatDocumento } from "../../lib/documento.js";

// wa.me quer só dígitos com DDI — assume Brasil (55) quando o número não veio com DDI
// (celular BR sempre tem 10 ou 11 dígitos com DDD; deixa passar como veio se já for maior).
function linkWhatsApp(celular) {
  const digitos = (celular || "").replace(/\D/g, "");
  if (!digitos) return null;
  const comDDI = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${comDDI}`;
}

const FIELDS = [
  { key: "nome", label: "Nome / Razão social" },
  { key: "tipo", label: "Tipo", type: "select", options: [{ value: "PF", label: "Pessoa Física" }, { value: "PJ", label: "Pessoa Jurídica" }] },
  {
    key: "documento", label: "CPF/CNPJ", optional: true,
    placeholder: "000.000.000-00",
    mask: (raw, values) => formatDocumento(values?.tipo, raw),
  },
  { key: "celular", label: "Celular", optional: true, placeholder: "(00) 00000-0000", mask: formatCelular },
  { key: "email", label: "Email", type: "email", optional: true },
  { key: "cep", label: "CEP", optional: true, onBlur: buscarEnderecoPorCep },
  { key: "logradouro", label: "Endereço", optional: true },
  { key: "numero", label: "Número", optional: true },
  { key: "complemento", label: "Complemento", optional: true },
  { key: "bairro", label: "Bairro", optional: true },
  { key: "cidade", label: "Cidade", optional: true },
  { key: "uf", label: "UF", optional: true },
  { key: "origem", label: "Origem", optional: true },
  { key: "contrato_renovacao", label: "Início do contrato", type: "date", optional: true },
];

export default function ClientesTab({ currentRole, orgId }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: clientes, loading, insert, update, remove } = useSupabaseTable("clientes", { orderBy: "nome", ascending: true, eq: orgEq });
  const { data: acessosPortal, refresh: refreshAcessos } = useSupabaseTable("cliente_logins", { select: "cliente_id", eq: orgEq });
  const temAcesso = useMemo(() => new Set(acessosPortal.map((a) => a.cliente_id)), [acessosPortal]);
  const [editing, setEditing] = useState(null); // null = fechado, {} = novo, {...} = editando
  const [busca, setBusca] = useState("");
  const podeExcluir = currentRole === "admin" || currentRole === "socio"; // RLS (clientes_del) já barra no banco — isso só esconde o botão

  const criarAcessoPortal = async (cliente) => {
    const email = prompt(`Email do "${cliente.nome}" pra acessar o Portal do Cliente:`, cliente.email || "");
    if (!email) return;
    const { data, error } = await supabase.functions.invoke("cliente-create-login", { body: { clienteId: cliente.id, email } });
    if (error) {
      alert((await error.context?.json?.().catch(() => null))?.error ?? error.message);
      return;
    }
    alert(data?.warning ?? "Acesso criado — as credenciais foram enviadas por email.");
    await refreshAcessos();
  };

  const filtrados = clientes.filter((c) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return c.nome.toLowerCase().includes(q)
      || (c.origem || "").toLowerCase().includes(q)
      || (c.celular || "").toLowerCase().includes(q)
      || (c.email || "").toLowerCase().includes(q)
      || (c.documento || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""));
  });

  return (
    <div>
      <SectionTitle
        icon={Users}
        title="Clientes"
        subtitle="Base de clientes e contratos"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar cliente..." />
            <button
              onClick={() => setEditing({})}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold"
              style={{ background: COLORS.ink, color: "#fff" }}
            >
              <Plus size={14} /> Novo
            </button>
          </div>
        }
      />
      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: COLORS.ink }}>
              {["Cliente", "Tipo", "CPF/CNPJ", "Celular", "Origem", "Início do contrato", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>{busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</td></tr>
            )}
            {filtrados.map((c, i) => (
              <tr
                key={c.id}
                onClick={() => setEditing(c)}
                className="cursor-pointer transition-colors hover:!bg-[rgba(165,121,59,0.06)]"
                style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}
              >
                <td className="px-4 py-3" style={{ color: COLORS.ink }}>{c.nome}</td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{c.tipo}</td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{c.documento ? formatDocumento(c.tipo, c.documento) : "—"}</td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>
                  <div className="flex items-center gap-2">
                    <span>{c.celular ? formatCelular(c.celular) : "—"}</span>
                    {linkWhatsApp(c.celular) && (
                      <a
                        href={linkWhatsApp(c.celular)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Abrir conversa no WhatsApp"
                        title="Abrir conversa no WhatsApp"
                        className="p-1 rounded hover:opacity-70"
                        style={{ color: "#25D366" }}
                      >
                        <MessageCircle size={16} />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{c.origem || "—"}</td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{c.contrato_renovacao || "—"}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    {podeExcluir && (
                      temAcesso.has(c.id) ? (
                        <span title="Já tem acesso ao Portal do Cliente" className="p-1.5" style={{ color: COLORS.success }}><UserCheck size={14} /></span>
                      ) : (
                        <button onClick={() => criarAcessoPortal(c)} aria-label="Criar acesso ao Portal do Cliente" title="Criar acesso ao Portal do Cliente" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.brass }}>
                          <KeyRound size={14} />
                        </button>
                      )
                    )}
                    <RowActions onEdit={() => setEditing(c)} onDelete={podeExcluir ? () => remove(c.id) : undefined} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>

      <RecordFormModal
        open={editing !== null}
        title={editing?.id ? "Editar cliente" : "Novo cliente"}
        fields={FIELDS}
        initialValues={editing}
        onClose={() => setEditing(null)}
        onSubmit={(values) => (editing?.id ? update(editing.id, values) : insert(values))}
      />
    </div>
  );
}
