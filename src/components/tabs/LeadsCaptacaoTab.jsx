import React, { useState } from "react";
import { MapPin } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import LeadsMap from "../LeadsMap.jsx";
import LeadsList from "../LeadsList.jsx";
import { COLORS } from "../../lib/theme.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
import { supabase } from "../../lib/supabaseClient.js";

const AREAS = [
  { value: "trabalhista", label: "Trabalhista" },
  { value: "familia", label: "Família" },
  { value: "tributario", label: "Tributário" },
  { value: "civel", label: "Cível" },
  { value: "penal", label: "Penal" },
  { value: "empresarial", label: "Empresarial" },
];

// Painel de captação (leads vindos do formulário público, ver LeadForm.jsx). Contato vem
// mascarado (null) na própria query pra quem não é admin/sócio — leads_captacao_view já
// resolve isso no banco, aqui só decide se mostra a coluna.
export default function LeadsCaptacaoTab({ orgId, currentRole }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: leads, refresh } = useSupabaseTable("leads_captacao_view", { eq: orgEq, orderBy: "created_at", ascending: false });
  const [areaAtiva, setAreaAtiva] = useState(AREAS[0].value);
  const podeVerContato = currentRole === "admin" || currentRole === "socio";

  const daArea = leads.filter((l) => l.area_direito === areaAtiva);

  const mudarStatus = async (id, status) => {
    await supabase.from("leads_captacao").update({ status }).eq("id", id);
    refresh();
  };

  return (
    <div>
      <SectionTitle icon={MapPin} title="Captação de Leads" subtitle="Contatos recebidos pelo formulário público do site, por área do direito" />

      <div className="flex flex-wrap gap-2 mb-5">
        {AREAS.map((a) => {
          const qtd = leads.filter((l) => l.area_direito === a.value).length;
          const ativo = areaAtiva === a.value;
          return (
            <button
              key={a.value}
              onClick={() => setAreaAtiva(a.value)}
              className="px-3 py-2 rounded-md text-sm font-semibold"
              style={{ background: ativo ? COLORS.ink : "transparent", color: ativo ? "#fff" : COLORS.ink, border: `1px solid ${ativo ? COLORS.ink : COLORS.line}` }}
            >
              {a.label} <span style={{ opacity: 0.7 }}>({qtd})</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <LeadsMap leads={daArea} />
        </Card>
        <Card className="!p-0 overflow-hidden">
          <LeadsList leads={daArea} onMudarStatus={mudarStatus} podeVerContato={podeVerContato} />
        </Card>
      </div>
    </div>
  );
}
