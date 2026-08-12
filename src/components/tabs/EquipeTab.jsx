import React, { useState } from "react";
import { Building2, Plus } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import Stamp from "../Stamp.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import { COLORS } from "../../lib/theme.js";
import { ROLES } from "../../config/permissions.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
import { supabase } from "../../lib/supabaseClient.js";

const METRIC_FIELDS = [
  { key: "cargo", label: "Cargo", optional: true },
  { key: "horas_mes", label: "Horas faturáveis no mês", type: "number" },
  { key: "meta_horas", label: "Meta de horas", type: "number" },
];

// Criação do Auth user (com senha temporária mandada por email) roda na Edge Function
// admin-create-user, que usa a service_role key — não dá pra fazer isso do client com a anon key.
const NEW_MEMBER_FIELDS = [
  { key: "nome", label: "Nome" },
  { key: "email", label: "Email", type: "email" },
  { key: "role", label: "Cargo", type: "select", options: ROLES.map((r) => ({ value: r.key, label: r.label })) },
];

export default function EquipeTab({ currentRole }) {
  // Lê de equipe_view (agregado, não editável diretamente — é view com group by).
  // Escreve na tabela profiles, que é a fonte real dessas colunas.
  const { data: equipe, loading, refresh } = useSupabaseTable("equipe_view", { orderBy: "nome", ascending: true });
  const [editing, setEditing] = useState(null); // {...} = editar métricas de quem já existe
  const [creating, setCreating] = useState(false); // novo colaborador

  const salvarMetricas = async (values) => {
    const { error } = await supabase.from("profiles").update(values).eq("id", editing.id);
    if (error) throw error;
    await refresh();
  };

  const criarColaborador = async (values) => {
    const { data, error } = await supabase.functions.invoke("admin-create-user", { body: values });
    // FunctionsHttpError não traz o corpo da resposta em error.message — busca ali o motivo real.
    if (error) throw new Error((await error.context?.json?.().catch(() => null))?.error ?? error.message);
    await refresh();
    // email de senha temporária falhou mas o colaborador já foi criado — avisa o admin.
    if (data?.warning) throw new Error(data.warning);
  };

  return (
    <div>
      <SectionTitle
        icon={Building2}
        title="Equipe"
        subtitle="Carga de trabalho e horas faturáveis"
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
        {equipe.map((e) => {
          const pct = e.meta ? Math.round((e.horas / e.meta) * 100) : 0;
          return (
            <Card key={e.id} className="cursor-pointer">
              <div onClick={() => setEditing(e)} className="flex items-center justify-between">
                <div>
                  <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 600, color: COLORS.ink }}>{e.nome}</p>
                  <p className="text-xs" style={{ color: COLORS.brass, letterSpacing: "0.04em" }}>{(e.cargo || "—").toUpperCase()}</p>
                </div>
                <Stamp tone="neutral">{e.ativos} ativos</Stamp>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1" style={{ color: COLORS.slate }}>
                  <span>Horas faturáveis</span>
                  <span>{e.horas}h / {e.meta}h</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: COLORS.line }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 90 ? COLORS.success : COLORS.brass }} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <RecordFormModal
        open={editing !== null}
        title={`Editar métricas — ${editing?.nome ?? ""}`}
        fields={METRIC_FIELDS}
        initialValues={editing}
        onClose={() => setEditing(null)}
        onSubmit={salvarMetricas}
      />

      <RecordFormModal
        open={creating}
        title="Novo colaborador"
        fields={NEW_MEMBER_FIELDS}
        initialValues={{}}
        onClose={() => setCreating(false)}
        onSubmit={criarColaborador}
      />
    </div>
  );
}
