import React, { useState } from "react";
import { Building2, Plus, Trash2, KeyRound } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import Stamp from "../Stamp.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import { COLORS } from "../../lib/theme.js";
import { ROLES } from "../../config/permissions.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
import { supabase } from "../../lib/supabaseClient.js";

// ponytail: horas faturáveis tiradas da tela por pedido — colunas continuam no banco
// (profiles.horas_mes/meta_horas), só não aparecem/editam por aqui por enquanto.
// "email" não vem pré-preenchido: mora em auth.users, não em profiles, e a view não
// expõe isso — deixar em branco significa "não mudar", só troca se digitar um novo.
// Cargo "Administrador(a)" só aparece na lista pra quem já é admin — sócio não promove
// (nem vê a opção de promover) ninguém a admin, mesma linha das outras restrições sócio×admin.
const cargoOptions = (currentRole) =>
  ROLES.filter((r) => r.key !== "admin" || currentRole === "admin").map((r) => ({ value: r.key, label: r.label }));

const metricFields = (currentRole) => [
  { key: "nome", label: "Nome" },
  { key: "email", label: "Novo email (deixe em branco pra não alterar)", type: "email", optional: true },
  { key: "role", label: "Cargo", type: "select", options: cargoOptions(currentRole) },
];

// Criação do Auth user (com senha temporária mandada por email) roda na Edge Function
// admin-create-user, que usa a service_role key — não dá pra fazer isso do client com a anon key.
const newMemberFields = (currentRole) => [
  { key: "nome", label: "Nome" },
  { key: "email", label: "Email", type: "email" },
  { key: "role", label: "Cargo", type: "select", options: cargoOptions(currentRole) },
];

// Lê o motivo real dentro do corpo da resposta (FunctionsHttpError não traz isso em
// error.message). Se for sessão morta (logout em outra aba, refresh token expirado etc.),
// desloga e recarrega em vez de deixar o formulário travado com um erro sem explicação.
async function tratarErroFuncao(error) {
  const msg = (await error.context?.json?.().catch(() => null))?.error ?? error.message;
  if (msg === "Não autenticado.") {
    alert("Sua sessão expirou. Faça login novamente.");
    await supabase.auth.signOut();
    window.location.reload();
    return null; // nunca chega a lançar — a página já está recarregando
  }
  return msg;
}

export default function EquipeTab({ currentRole, orgId }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  // Lê de equipe_view (agregado, não editável diretamente — é view com group by).
  // Escreve na tabela profiles, que é a fonte real dessas colunas.
  const { data: equipe, loading, refresh } = useSupabaseTable("equipe_view", { orderBy: "nome", ascending: true, eq: orgEq });
  const [editing, setEditing] = useState(null); // {...} = editar métricas de quem já existe
  const [creating, setCreating] = useState(false); // novo colaborador
  // sócio mexe geral, menos no admin; admin mexe em todo mundo — mesma regra das Edge
  // Functions admin-delete-user/admin-reset-password, aqui só esconde o botão (a de
  // verdade é lá).
  const podeGerenciar = (alvo) => currentRole === "admin" || (currentRole === "socio" && alvo.role !== "admin");

  const salvarMetricas = async ({ email, role, ...values }) => {
    // "cargo" (texto livre exibido no card) segue o rótulo do perfil escolhido — mantém o
    // card com algo legível sem precisar de mais um campo digitado à parte.
    const payload = role ? { ...values, role, cargo: ROLES.find((r) => r.key === role)?.label ?? role } : values;
    const { error } = await supabase.from("profiles").update(payload).eq("id", editing.id);
    if (error) throw error;

    if (email) {
      // login (auth.users) é separado de profiles — precisa de service_role, vai pela Edge Function.
      const { error: emailErr } = await supabase.functions.invoke("admin-update-email", { body: { userId: editing.id, email } });
      if (emailErr) {
        const msg = await tratarErroFuncao(emailErr);
        if (msg) throw new Error(msg);
        return;
      }
    }

    await refresh();
  };

  const criarColaborador = async (values) => {
    // orgId só vai quando é o platform admin criando colaborador dentro de outra empresa —
    // um admin normal cria sempre na própria (a function ignora orgId nesse caso).
    const { data, error } = await supabase.functions.invoke("admin-create-user", { body: { ...values, orgId } });
    // FunctionsHttpError não traz o corpo da resposta em error.message — busca ali o motivo real.
    if (error) throw new Error((await error.context?.json?.().catch(() => null))?.error ?? error.message);
    await refresh();
    // email de senha temporária falhou mas o colaborador já foi criado — avisa o admin.
    if (data?.warning) throw new Error(data.warning);
  };

  const excluirColaborador = async (id) => {
    if (!confirm("Excluir este colaborador? A conta de login dele também é apagada.")) return;
    const { error } = await supabase.functions.invoke("admin-delete-user", { body: { userId: id } });
    if (error) {
      const msg = await tratarErroFuncao(error);
      if (msg) alert(msg);
      return;
    }
    await refresh();
  };

  const redefinirSenha = async (colaborador) => {
    if (!confirm(`Gerar uma nova senha temporária pra ${colaborador.nome} e mandar por email?`)) return;
    const { data, error } = await supabase.functions.invoke("admin-reset-password", { body: { userId: colaborador.id } });
    if (error) {
      const msg = await tratarErroFuncao(error);
      if (msg) alert(msg);
      return;
    }
    alert(data?.warning ?? "Senha redefinida — o novo acesso foi enviado por email.");
  };

  return (
    <div>
      <SectionTitle
        icon={Building2}
        title="Equipe"
        subtitle="Colaboradores do escritório"
        action={
          currentRole === "admin" && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold"
              style={{ background: COLORS.ink, color: "#fff" }}
            >
              <Plus size={14} /> Novo colaborador
            </button>
          )
        }
      />
      {!loading && equipe.length === 0 && (
        <p className="text-sm" style={{ color: COLORS.slate }}>Nenhum membro da equipe cadastrado ainda.</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {equipe.map((e) => (
          <Card key={e.id} className="cursor-pointer">
            <div onClick={() => setEditing(e)} className="flex items-center justify-between">
              <div>
                <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 600, color: COLORS.ink }}>{e.nome}</p>
                <p className="text-xs" style={{ color: COLORS.brass, letterSpacing: "0.04em" }}>{(e.cargo || "—").toUpperCase()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Stamp tone="neutral">{e.ativos} ativos</Stamp>
                {podeGerenciar(e) && (
                  <button
                    onClick={(ev) => { ev.stopPropagation(); redefinirSenha(e); }}
                    aria-label="Redefinir senha"
                    title="Redefinir senha"
                    className="p-1.5 rounded hover:opacity-70"
                    style={{ color: COLORS.slate }}
                  >
                    <KeyRound size={14} />
                  </button>
                )}
                {podeGerenciar(e) && (
                  <button
                    onClick={(ev) => { ev.stopPropagation(); excluirColaborador(e.id); }}
                    aria-label="Excluir colaborador"
                    className="p-1.5 rounded hover:opacity-70"
                    style={{ color: COLORS.wine }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <RecordFormModal
        open={editing !== null}
        title={`Editar métricas — ${editing?.nome ?? ""}`}
        fields={metricFields(currentRole)}
        initialValues={editing}
        onClose={() => setEditing(null)}
        onSubmit={salvarMetricas}
      />

      <RecordFormModal
        open={creating}
        title="Novo colaborador"
        fields={newMemberFields(currentRole)}
        initialValues={{}}
        onClose={() => setCreating(false)}
        onSubmit={criarColaborador}
      />
    </div>
  );
}
