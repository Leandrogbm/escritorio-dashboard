import React, { useState } from "react";
import { UserPlus, Plus, X, Trash2, ChevronRight, ChevronLeft, UserCheck } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import { COLORS } from "../../lib/theme.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";

// Funil de captação — gente que já procurou o escritório por conta própria (WhatsApp,
// indicação, anúncio) e ainda não é cliente. NÃO é "contatar parte de processo alheio pra
// oferecer serviço" (isso continua fora, por ética OAB arts. 5º-7º/39-41) — aqui a pessoa
// já chegou até o escritório sozinha. "Converter" cria um cliente de verdade e mantém o
// lead no funil, marcado como Convertido (histórico, não apaga).
const COLUNAS = [
  { nome: "Novo", cor: "#2563a3" },
  { nome: "Consulta agendada", cor: COLORS.brass },
  { nome: "Proposta enviada", cor: "#7c5cbf" },
  { nome: "Convertido", cor: COLORS.success },
];

export default function LeadsTab({ orgId }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: leads, insert, update, remove } = useSupabaseTable("leads", { eq: orgEq, orderBy: "created_at", ascending: true });
  const { insert: insertCliente } = useSupabaseTable("clientes", { eq: orgEq });

  const [formAberto, setFormAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [origem, setOrigem] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const criar = async (e) => {
    e.preventDefault();
    if (!nome.trim()) return;
    await insert({ nome: nome.trim(), telefone: telefone.trim() || null, origem: origem.trim() || null, observacoes: observacoes.trim() || null });
    setNome(""); setTelefone(""); setOrigem(""); setObservacoes("");
    setFormAberto(false);
  };

  const nomesColunas = COLUNAS.map((c) => c.nome);
  const mover = (lead, delta) => {
    const i = nomesColunas.indexOf(lead.etapa) + delta;
    if (i < 0 || i >= COLUNAS.length) return;
    update(lead.id, { etapa: nomesColunas[i] });
  };
  const soltar = (etapa, e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) update(id, { etapa });
  };

  const converter = async (lead) => {
    await insertCliente({ nome: lead.nome, tipo: "PF", origem: lead.origem });
    await update(lead.id, { etapa: "Convertido" });
  };

  return (
    <div>
      <SectionTitle
        icon={UserPlus}
        title="Leads"
        subtitle="Funil de captação — quem já procurou o escritório"
        action={!formAberto && (
          <button onClick={() => setFormAberto(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
            <Plus size={14} /> Novo lead
          </button>
        )}
      />

      {formAberto && (
        <Card className="mb-5">
          <form onSubmit={criar} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Novo lead</p>
              <button type="button" onClick={() => setFormAberto(false)} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={16} /></button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" autoFocus className="flex-1 min-w-[160px] px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }} />
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Telefone (opcional)" className="px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }} />
              <input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Origem (ex.: Indicação, WhatsApp)" className="px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }} />
            </div>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações (opcional)..." rows={2} className="w-full px-3 py-2 rounded-md text-sm resize-y" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }} />
            <button type="submit" className="self-end flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
              <Plus size={14} /> Adicionar
            </button>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUNAS.map((coluna, ci) => (
          <div key={coluna.nome}>
            <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-md" style={{ background: coluna.cor }}>
              <p className="text-xs font-semibold" style={{ color: "#fff" }}>{coluna.nome}</p>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>{leads.filter((l) => l.etapa === coluna.nome).length}</span>
            </div>
            <div
              className="flex flex-col gap-2 min-h-[40px] rounded-md"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => soltar(coluna.nome, e)}
            >
              {leads.filter((l) => l.etapa === coluna.nome).map((l) => (
                <div
                  key={l.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                  className="p-2.5 rounded-md text-sm cursor-grab active:cursor-grabbing"
                  style={{ border: `1px solid ${COLORS.line}`, background: COLORS.paperRaised }}
                >
                  <p style={{ color: COLORS.ink, fontWeight: 600 }}>{l.nome}</p>
                  {l.telefone && <p className="text-xs mt-0.5" style={{ color: COLORS.slate }}>{l.telefone}</p>}
                  {l.origem && <p className="text-xs mt-0.5" style={{ color: COLORS.slate }}>{l.origem}</p>}
                  {l.observacoes && <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: COLORS.slate }}>{l.observacoes}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => mover(l, -1)} disabled={ci === 0} aria-label="Mover pra trás" className="p-1 rounded hover:opacity-70 disabled:opacity-20" style={{ color: COLORS.slate }}>
                        <ChevronLeft size={14} />
                      </button>
                      <button onClick={() => mover(l, 1)} disabled={ci === COLUNAS.length - 1} aria-label="Mover pra frente" className="p-1 rounded hover:opacity-70 disabled:opacity-20" style={{ color: COLORS.slate }}>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      {l.etapa !== "Convertido" && (
                        <button onClick={() => converter(l)} aria-label="Converter em cliente" title="Converter em cliente" className="p-1 rounded hover:opacity-70" style={{ color: COLORS.success }}>
                          <UserCheck size={14} />
                        </button>
                      )}
                      <button onClick={() => remove(l.id)} aria-label="Excluir lead" className="p-1 rounded hover:opacity-70" style={{ color: COLORS.wine }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
