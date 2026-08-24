import React, { useEffect, useState } from "react";
import { PenTool, Radar, Plus, Trash2, RefreshCw } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { supabase } from "../lib/supabaseClient.js";

// Credenciais de D4Sign/Jusbrasil são DA PRÓPRIA EMPRESA (cada escritório usa a conta
// dele) — ficam salvas em organizations, mesmas colunas que Minha Empresa já usa pro resto
// do perfil. Sem teste contra conta real dessas duas (não temos credencial) — construído a
// partir da documentação oficial de cada uma.
const inputStyle = { border: `1px solid ${COLORS.line}`, color: COLORS.ink };

export default function IntegracoesSection({ orgId }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: orgRows, refresh: refreshOrg } = useSupabaseTable("organizations", {
    select: "d4sign_token,d4sign_crypt_key,d4sign_safe_uuid,jusbrasil_token", eq: orgId ? ["id", orgId] : undefined,
  });
  const org = orgRows[0];
  const [d4, setD4] = useState({ d4sign_token: "", d4sign_crypt_key: "", d4sign_safe_uuid: "" });
  const [jusToken, setJusToken] = useState("");
  const [salvandoD4, setSalvandoD4] = useState(false);
  const [salvandoJus, setSalvandoJus] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [novaOab, setNovaOab] = useState({ nome: "", numero: "", uf: "" });
  const [salvandoOab, setSalvandoOab] = useState(false);

  // carrega os valores salvos assim que a organização chega (fetch async)
  useEffect(() => {
    if (!org) return;
    setD4({ d4sign_token: org.d4sign_token ?? "", d4sign_crypt_key: org.d4sign_crypt_key ?? "", d4sign_safe_uuid: org.d4sign_safe_uuid ?? "" });
    setJusToken(org.jusbrasil_token ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.d4sign_token, org?.d4sign_crypt_key, org?.d4sign_safe_uuid, org?.jusbrasil_token]);

  const { data: oabs, refresh: refreshOabs } = useSupabaseTable("oabs_monitoradas", { select: "id,nome_advogado,numero_oab,uf_oab", eq: orgEq });

  const salvarD4 = async (e) => {
    e.preventDefault();
    setSalvandoD4(true);
    const { error } = await supabase.from("organizations").update(d4).eq("id", orgId);
    setSalvandoD4(false);
    if (error) return alert(error.message);
    await refreshOrg();
  };

  const salvarJus = async (e) => {
    e.preventDefault();
    setSalvandoJus(true);
    const { error } = await supabase.from("organizations").update({ jusbrasil_token: jusToken }).eq("id", orgId);
    setSalvandoJus(false);
    if (error) return alert(error.message);
    await refreshOrg();
  };

  const adicionarOab = async (e) => {
    e.preventDefault();
    if (!novaOab.nome.trim() || !novaOab.numero.trim() || !novaOab.uf.trim()) return;
    setSalvandoOab(true);
    const { error } = await supabase.functions.invoke("jusbrasil-monitorar-oab", {
      body: { nome: novaOab.nome, numero: novaOab.numero, uf: novaOab.uf.toUpperCase(), orgId },
    });
    setSalvandoOab(false);
    if (error) {
      alert((await error.context?.json?.().catch(() => null))?.error ?? error.message);
      return;
    }
    setNovaOab({ nome: "", numero: "", uf: "" });
    await refreshOabs();
  };

  const removerOab = async (id) => {
    if (!confirm("Parar de monitorar essa OAB?")) return;
    await supabase.from("oabs_monitoradas").delete().eq("id", id);
    await refreshOabs();
  };

  const sincronizarAgora = async () => {
    setSincronizando(true);
    const { data, error } = await supabase.functions.invoke("jusbrasil-sync", { body: {} });
    setSincronizando(false);
    if (error) {
      alert((await error.context?.json?.().catch(() => null))?.error ?? error.message);
      return;
    }
    const novos = data?.resultados?.reduce((s, r) => s + (r.novos ?? 0), 0) ?? 0;
    alert(novos > 0 ? `${novos} processo(s) novo(s) encontrado(s) — confira em "Processos descobertos".` : "Nenhum processo novo encontrado.");
  };

  return (
    <div className="flex flex-col gap-8 mt-8 pt-6" style={{ borderTop: `1px solid ${COLORS.line}` }}>
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>
          <PenTool size={16} color={COLORS.brass} /> Assinatura eletrônica (D4Sign)
        </p>
        <p className="text-xs mb-3" style={{ color: COLORS.slate }}>
          Precisa de uma conta D4Sign própria — crie um "cofre" (safe) lá e cole as credenciais aqui (menu "Dev API" da conta D4Sign).
        </p>
        <form onSubmit={salvarD4} className="flex flex-col gap-2 max-w-md">
          <input value={d4.d4sign_token} onChange={(e) => setD4((v) => ({ ...v, d4sign_token: e.target.value }))} placeholder="tokenAPI" className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
          <input value={d4.d4sign_crypt_key} onChange={(e) => setD4((v) => ({ ...v, d4sign_crypt_key: e.target.value }))} placeholder="cryptKey" className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
          <input value={d4.d4sign_safe_uuid} onChange={(e) => setD4((v) => ({ ...v, d4sign_safe_uuid: e.target.value }))} placeholder="UUID do cofre (safe)" className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
          <button type="submit" disabled={salvandoD4} className="self-start px-3.5 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: salvandoD4 ? 0.6 : 1 }}>
            {salvandoD4 ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </div>

      <div>
        <p className="flex items-center gap-2 text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>
          <Radar size={16} color={COLORS.brass} /> Captação automática de processo (Jusbrasil)
        </p>
        <p className="text-xs mb-3" style={{ color: COLORS.slate }}>
          Precisa de token do Jusbrasil Soluções (módulo de monitoramento por OAB — fale com o comercial deles pra habilitar).
        </p>
        <form onSubmit={salvarJus} className="flex flex-wrap items-center gap-2 max-w-md mb-4">
          <input value={jusToken} onChange={(e) => setJusToken(e.target.value)} placeholder="Token do Jusbrasil" className="flex-1 min-w-[160px] px-3 py-2 rounded-md text-sm" style={inputStyle} />
          <button type="submit" disabled={salvandoJus} className="px-3.5 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: salvandoJus ? 0.6 : 1 }}>
            {salvandoJus ? "Salvando..." : "Salvar"}
          </button>
        </form>

        <form onSubmit={adicionarOab} className="flex flex-wrap items-end gap-2 mb-3">
          <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
            Nome do advogado
            <input value={novaOab.nome} onChange={(e) => setNovaOab((v) => ({ ...v, nome: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={{ ...inputStyle, minWidth: 180 }} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
            Número OAB
            <input value={novaOab.numero} onChange={(e) => setNovaOab((v) => ({ ...v, numero: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={{ ...inputStyle, width: 110 }} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
            UF
            <input value={novaOab.uf} onChange={(e) => setNovaOab((v) => ({ ...v, uf: e.target.value }))} maxLength={2} placeholder="SP" className="px-3 py-2 rounded-md text-sm" style={{ ...inputStyle, width: 60 }} />
          </label>
          <button type="submit" disabled={salvandoOab} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: salvandoOab ? 0.6 : 1 }}>
            <Plus size={14} /> {salvandoOab ? "Cadastrando..." : "Monitorar OAB"}
          </button>
        </form>

        <button onClick={sincronizarAgora} disabled={sincronizando} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold mb-2" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, opacity: sincronizando ? 0.6 : 1 }}>
          <RefreshCw size={14} className={sincronizando ? "animate-spin" : ""} /> Sincronizar agora
        </button>
        {oabs.length === 0 ? (
          <p className="text-sm" style={{ color: COLORS.slate }}>Nenhuma OAB monitorada ainda.</p>
        ) : (
          <div className="flex flex-col gap-1.5 max-w-md">
            {oabs.map((o) => (
              <div key={o.id} className="flex items-center justify-between px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}` }}>
                <span style={{ color: COLORS.ink }}>{o.nome_advogado} — OAB {o.numero_oab}/{o.uf_oab}</span>
                <button onClick={() => removerOab(o.id)} aria-label="Parar de monitorar" className="p-1 rounded hover:opacity-70" style={{ color: COLORS.wine }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
