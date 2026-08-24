import React, { useState } from "react";
import { Code2, Plus, Trash2, Copy } from "lucide-react";
import Card from "./Card.jsx";
import { COLORS } from "../lib/theme.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { supabase } from "../lib/supabaseClient.js";

// Chaves de API pra integração externa (ERP/CRM) — a Edge Function api-gateway usa isso pra
// autenticar em vez de sessão de usuário. A chave em texto puro só aparece uma vez, na hora
// que é gerada (o banco guarda só o hash); depois só mostra o prefixo, pra reconhecer.
export default function ApiKeysSection({ orgId }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: chaves, refresh } = useSupabaseTable("api_keys", { select: "id,nome,key_prefix,created_at,last_used_at", eq: orgEq });
  const [gerando, setGerando] = useState(false);
  const [chaveNova, setChaveNova] = useState(null); // texto puro, só uma vez

  const gerar = async () => {
    const nome = prompt("Nome pra essa chave (ex.: \"ERP financeiro\", \"Zapier\"):");
    if (!nome) return;
    setGerando(true);
    const { data, error } = await supabase.functions.invoke("api-keys-create", { body: { nome, orgId } });
    setGerando(false);
    if (error) {
      alert((await error.context?.json?.().catch(() => null))?.error ?? error.message);
      return;
    }
    setChaveNova(data.chave);
    await refresh();
  };

  const revogar = async (id) => {
    if (!confirm("Revogar essa chave? Qualquer integração usando ela para de funcionar na hora.")) return;
    await supabase.from("api_keys").delete().eq("id", id);
    await refresh();
  };

  return (
    <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.ink }}>
            <Code2 size={16} color={COLORS.brass} /> API pública
          </p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.slate }}>
            Chaves pra sistema externo (ERP/CRM) ler/criar cliente, processo e financeiro.
          </p>
        </div>
        <button onClick={gerar} disabled={gerando} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: gerando ? 0.6 : 1 }}>
          <Plus size={14} /> Gerar chave
        </button>
      </div>

      {chaveNova && (
        <div className="mb-4 p-3 rounded-md text-xs" style={{ background: "rgba(165,121,59,0.1)", color: COLORS.ink }}>
          <p className="font-semibold mb-1">Copie agora — essa chave não aparece de novo:</p>
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 rounded" style={{ background: "#fff", border: `1px solid ${COLORS.line}`, wordBreak: "break-all" }}>{chaveNova}</code>
            <button onClick={() => navigator.clipboard.writeText(chaveNova)} aria-label="Copiar" className="p-1.5 rounded hover:opacity-70 shrink-0" style={{ color: COLORS.slate }}>
              <Copy size={14} />
            </button>
          </div>
        </div>
      )}

      {chaves.length === 0 ? (
        <p className="text-sm" style={{ color: COLORS.slate }}>Nenhuma chave gerada ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {chaves.map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}` }}>
              <div className="min-w-0">
                <p style={{ color: COLORS.ink, fontWeight: 600 }}>{k.nome}</p>
                <p className="text-xs font-mono" style={{ color: COLORS.slate }}>
                  {k.key_prefix}… · criada {new Date(k.created_at).toLocaleDateString("pt-BR")}
                  {k.last_used_at && ` · usada por último em ${new Date(k.last_used_at).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <button onClick={() => revogar(k.id)} aria-label="Revogar chave" className="p-1.5 rounded hover:opacity-70 shrink-0" style={{ color: COLORS.wine }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
