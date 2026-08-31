import React, { useEffect, useMemo, useState } from "react";
import { Users, Plus, MessageCircle, UserCheck, KeyRound, FolderOpen, Search } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import RowActions from "../RowActions.jsx";
import { TableHead, Tr } from "../TableList.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import ClienteDocumentosPagina from "../ClienteDocumentosPagina.jsx";
import ClientePagina from "../ClientePagina.jsx";
import EscavadorBuscaModal from "../EscavadorBuscaModal.jsx";
import SearchInput from "../SearchInput.jsx";
import { COLORS } from "../../lib/theme.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
import { supabase } from "../../lib/supabaseClient.js";
import { buscarEnderecoPorCep } from "../../lib/viaCep.js";
import { buscarEmpresaPorCnpj } from "../../lib/brasilApi.js";
import { formatCelular } from "../../lib/celular.js";
import { formatDocumento } from "../../lib/documento.js";
import { avisoLimitePlano } from "../../lib/limitesPlano.js";

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
    // Só dispara pra CNPJ (14 dígitos) — buscarEmpresaPorCnpj ignora CPF sozinha. Preenche
    // razão social/endereço/contato direto da Receita, sem precisar digitar tudo na mão.
    onBlur: buscarEmpresaPorCnpj,
  },
  { key: "celular", label: "Celular", optional: true, placeholder: "(00) 00000-0000", mask: formatCelular },
  { key: "celular2", label: "2º telefone (opcional)", optional: true, placeholder: "(00) 00000-0000", mask: formatCelular },
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

export default function ClientesTab({ currentRole, orgId, profile, onAbrirProcesso, onAbrirFinanceiro }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: clientes, loading, insert, update, remove } = useSupabaseTable("clientes", { orderBy: "nome", ascending: true, eq: orgEq });
  const { data: acessosPortal, refresh: refreshAcessos } = useSupabaseTable("cliente_logins", { select: "cliente_id", eq: orgEq });
  const temAcesso = useMemo(() => new Set(acessosPortal.map((a) => a.cliente_id)), [acessosPortal]);
  const [editing, setEditing] = useState(null); // null = fechado, {} = novo, {...} = editando
  const [vendoDocumentos, setVendoDocumentos] = useState(null); // cliente aberto na pasta de documentos
  const [buscandoProcessos, setBuscandoProcessos] = useState(null); // cliente aberto na busca Escavador
  const [clienteAberto, setClienteAberto] = useState(null); // cliente aberto na página cheia (processos+financeiro)
  const [busca, setBusca] = useState("");
  const podeExcluir = currentRole === "admin" || currentRole === "socio"; // RLS (clientes_del) já barra no banco — isso só esconde o botão

  // Limite do plano (plan_limits.limite_clientes) — checagem client-side só pra avisar antes
  // e oferecer upgrade; a trava de verdade é a RLS clientes_ins, que barra mesmo que essa
  // checagem falhe/esteja desatualizada.
  const abrirNovoCliente = () => {
    const aviso = avisoLimitePlano(profile?.organizations, "limite_clientes", clientes.length, "clientes cadastrados");
    if (aviso) return alert(aviso);
    setEditing({});
  };

  // Mesmo motivo do ProcessosTab: <main> é quem rola, não a window — sem isso o botão
  // "Voltar" da página de documentos/cliente sai da tela se a lista estava rolada.
  useEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
  }, [vendoDocumentos, clienteAberto]);

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

  if (vendoDocumentos) {
    return <ClienteDocumentosPagina cliente={vendoDocumentos} orgId={orgId} profile={profile} onVoltar={() => setVendoDocumentos(null)} />;
  }

  if (clienteAberto) {
    // Cliente pode ter sido editado desde que a página abriu — pega a versão mais fresca da
    // lista já carregada, cai no que tinha se ainda não sincronizou (mesmo padrão do
    // ProcessosTab).
    const atual = clientes.find((c) => c.id === clienteAberto.id) ?? clienteAberto;
    return (
      <>
        <ClientePagina
          cliente={atual}
          orgId={orgId}
          podeExcluir={podeExcluir}
          onVoltar={() => setClienteAberto(null)}
          onEditar={() => setEditing(atual)}
          onExcluir={() => { remove(atual.id); setClienteAberto(null); }}
          onDocumentos={() => setVendoDocumentos(atual)}
          onAbrirProcesso={onAbrirProcesso}
          onAbrirFinanceiro={onAbrirFinanceiro}
        />
        <RecordFormModal
          open={editing !== null}
          title="Editar cliente"
          fields={FIELDS}
          initialValues={editing}
          onClose={() => setEditing(null)}
          onSubmit={(values) => update(editing.id, values)}
        />
      </>
    );
  }

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
              onClick={abrirNovoCliente}
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
          <TableHead columns={["Cliente", "CPF/CNPJ", "Celular", "Origem", "Início do contrato", ""]} />
          <tbody>
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>{busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</td></tr>
            )}
            {filtrados.map((c) => (
              <Tr key={c.id} onClick={() => setClienteAberto(c)}>
                <td className="px-4 py-3.5">
                  <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 600, fontSize: 15, color: COLORS.ink }}>{c.nome}</p>
                  <p className="text-xs mt-0.5" style={{ color: COLORS.brassText }}>{c.tipo === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}</p>
                </td>
                <td className="px-4 py-3.5" style={{ color: COLORS.slate }}>{c.documento ? formatDocumento(c.tipo, c.documento) : "—"}</td>
                <td className="px-4 py-3.5" style={{ color: COLORS.slate }}>
                  {[c.celular, c.celular2].filter(Boolean).length === 0 && "—"}
                  {[c.celular, c.celular2].filter(Boolean).map((tel) => (
                    <div key={tel} className="flex items-center gap-2">
                      <span>{formatCelular(tel)}</span>
                      {linkWhatsApp(tel) && (
                        <a
                          href={linkWhatsApp(tel)}
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
                  ))}
                </td>
                <td className="px-4 py-3.5" style={{ color: COLORS.slate }}>{c.origem || "—"}</td>
                <td className="px-4 py-3.5" style={{ color: COLORS.slate }}>{c.contrato_renovacao || "—"}</td>
                <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setVendoDocumentos(c)} aria-label="Documentos do cliente" title="Documentos do cliente" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.brass }}>
                      <FolderOpen size={14} />
                    </button>
                    <button onClick={() => setBuscandoProcessos(c)} aria-label="Buscar processos (Escavador)" title="Buscar processos (Escavador)" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.brass }}>
                      <Search size={14} />
                    </button>
                    {podeExcluir && (
                      temAcesso.has(c.id) ? (
                        <span title="Já tem acesso ao Portal do Cliente" className="p-1.5" style={{ color: COLORS.success }}><UserCheck size={14} /></span>
                      ) : (
                        <button onClick={() => criarAcessoPortal(c)} aria-label="Criar acesso ao Portal do Cliente" title="Criar acesso ao Portal do Cliente" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.brass }}>
                          <KeyRound size={14} />
                        </button>
                      )
                    )}
                    <RowActions onEdit={() => setClienteAberto(c)} onDelete={podeExcluir ? () => remove(c.id) : undefined} />
                  </div>
                </td>
              </Tr>
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

      {buscandoProcessos && (
        <EscavadorBuscaModal cliente={buscandoProcessos} orgId={orgId} onClose={() => setBuscandoProcessos(null)} />
      )}
    </div>
  );
}
