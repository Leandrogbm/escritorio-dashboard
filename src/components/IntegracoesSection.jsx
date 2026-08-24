import React, { useEffect, useState } from "react";
import { PenTool, Radar, RefreshCw, ListChecks } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { supabase } from "../lib/supabaseClient.js";

// Credenciais de D4Sign/Jusbrasil são DA PRÓPRIA EMPRESA (cada escritório usa a conta
// dele) — ficam salvas em organizations, mesmas colunas que Minha Empresa já usa pro resto
// do perfil. Sem teste contra conta real dessas duas (não temos credencial) — construído a
// partir da documentação oficial de cada uma.
//
// Rótulo em linguagem simples pra quem não é técnico + o termo original entre parênteses
// (assim quem olhar a tela do provedor sabe qual campo bate com qual) + passo a passo de
// onde achar cada dado — pedido explícito do usuário depois de mostrar isso pra um cliente
// não-técnico que não reconheceu "tokenAPI"/"cryptKey".
const inputStyle = { border: `1px solid ${COLORS.line}`, color: COLORS.ink };
const labelStyle = { color: COLORS.ink, fontWeight: 600 };
const hintStyle = { color: COLORS.slate, fontWeight: 400 };

function ComoConseguir({ passos }) {
  return (
    <div className="mb-4 px-3 py-3 rounded-md text-xs max-w-md" style={{ background: "rgba(165,121,59,0.08)", color: COLORS.ink }}>
      <p className="flex items-center gap-1.5 font-semibold mb-1.5"><ListChecks size={13} color={COLORS.brass} /> Onde encontrar isso</p>
      <ol className="list-decimal pl-4 flex flex-col gap-1">
        {passos.map((p, i) => <li key={i} style={{ color: COLORS.slate }}>{p}</li>)}
      </ol>
    </div>
  );
}

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

  // carrega os valores salvos assim que a organização chega (fetch async)
  useEffect(() => {
    if (!org) return;
    setD4({ d4sign_token: org.d4sign_token ?? "", d4sign_crypt_key: org.d4sign_crypt_key ?? "", d4sign_safe_uuid: org.d4sign_safe_uuid ?? "" });
    setJusToken(org.jusbrasil_token ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.d4sign_token, org?.d4sign_crypt_key, org?.d4sign_safe_uuid, org?.jusbrasil_token]);

  // Quem é monitorado é decidido pelo cadastro do colaborador (Equipe → OAB), não uma lista
  // separada — aqui só mostra quem já tem OAB preenchida, pra conferir.
  const { data: advogados } = useSupabaseTable("profiles", { select: "nome,oab_numero,oab_uf", eq: orgEq });
  const comOab = advogados.filter((a) => a.oab_numero);

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

  const sincronizarAgora = async () => {
    setSincronizando(true);
    const { data, error } = await supabase.functions.invoke("jusbrasil-sync", { body: {} });
    setSincronizando(false);
    if (error) {
      alert((await error.context?.json?.().catch(() => null))?.error ?? error.message);
      return;
    }
    const novos = data?.resultados?.reduce((s, r) => s + (r.novos ?? 0), 0) ?? 0;
    alert(novos > 0 ? `${novos} processo(s) novo(s) encontrado(s) — confira em "Processos" (banner no topo).` : "Nenhum processo novo encontrado.");
  };

  return (
    <div className="flex flex-col gap-8 mt-8 pt-6" style={{ borderTop: `1px solid ${COLORS.line}` }}>
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>
          <PenTool size={16} color={COLORS.brass} /> Assinatura eletrônica
        </p>
        <p className="text-xs mb-3" style={{ color: COLORS.slate }}>
          Pra mandar documento pra assinar sem sair do mysaldo, conecte a conta D4Sign do escritório aqui embaixo — são 3 códigos, você pega tudo dentro da conta D4Sign de vocês.
        </p>

        <ComoConseguir passos={[
          <>Entre em <strong>secure.d4sign.com.br</strong> com o login de administrador da conta D4Sign do escritório.</>,
          <>No menu, procure por <strong>"Dev API"</strong> (ou "Integrações"). Lá aparecem dois códigos: um chamado <strong>Token</strong> e outro <strong>Crypt Key</strong> — copie os dois.</>,
          <>Se essa tela não aparecer, mande um email pra <strong>suporte@d4sign.com.br</strong> pedindo pra liberar o acesso via API da conta — eles respondem com os códigos.</>,
          <>Depois, vá em <strong>"Cofres"</strong> (ou "Safes"), abra a pasta onde os documentos vão ficar guardados (ou crie uma nova) e copie o código dela.</>,
        ]} />

        <form onSubmit={salvarD4} className="flex flex-col gap-3 max-w-md">
          <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
            <span style={labelStyle}>Código de acesso</span> <span>(chamado de "Token" na D4Sign)</span>
            <input value={d4.d4sign_token} onChange={(e) => setD4((v) => ({ ...v, d4sign_token: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
            <span style={labelStyle}>Chave de segurança</span> <span>(chamada de "Crypt Key" na D4Sign)</span>
            <input value={d4.d4sign_crypt_key} onChange={(e) => setD4((v) => ({ ...v, d4sign_crypt_key: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
            <span style={labelStyle}>Código da pasta de documentos</span> <span>(UUID do "Cofre"/"Safe" na D4Sign)</span>
            <input value={d4.d4sign_safe_uuid} onChange={(e) => setD4((v) => ({ ...v, d4sign_safe_uuid: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
          </label>
          <button type="submit" disabled={salvandoD4} className="self-start px-3.5 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: salvandoD4 ? 0.6 : 1 }}>
            {salvandoD4 ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </div>

      <div>
        <p className="flex items-center gap-2 text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>
          <Radar size={16} color={COLORS.brass} /> Captação automática de processo
        </p>
        <p className="text-xs mb-3" style={{ color: COLORS.slate }}>
          Avisa sozinho quando aparece processo novo em nome de um advogado do escritório. Quem é monitorado é decidido pela OAB cadastrada em cada colaborador (aba Equipe → editar) — não tem cadastro separado aqui.
        </p>

        <ComoConseguir passos={[
          <>Fale com o time comercial do <strong>Jusbrasil Soluções</strong> (jusbrasil.com.br) e contrate o módulo <strong>"Monitoramento por OAB"</strong>, se o escritório ainda não tiver.</>,
          <>Peça pra eles te passarem o <strong>token de acesso à API</strong> da conta.</>,
          <>Cole esse código no campo abaixo.</>,
        ]} />

        <form onSubmit={salvarJus} className="flex flex-col gap-2 max-w-md mb-4">
          <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
            <span style={labelStyle}>Código de acesso</span> <span>(token da API do Jusbrasil)</span>
            <input value={jusToken} onChange={(e) => setJusToken(e.target.value)} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
          </label>
          <button type="submit" disabled={salvandoJus} className="self-start px-3.5 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: salvandoJus ? 0.6 : 1 }}>
            {salvandoJus ? "Salvando..." : "Salvar"}
          </button>
        </form>

        <button onClick={sincronizarAgora} disabled={sincronizando} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold mb-3" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, opacity: sincronizando ? 0.6 : 1 }}>
          <RefreshCw size={14} className={sincronizando ? "animate-spin" : ""} /> Sincronizar agora
        </button>

        <p className="text-xs mb-1" style={{ color: COLORS.slate }}>Colaboradores monitorados hoje:</p>
        {comOab.length === 0 ? (
          <p className="text-sm" style={{ color: COLORS.slate }}>Nenhum colaborador com OAB cadastrada ainda — preencha em Equipe.</p>
        ) : (
          <div className="flex flex-col gap-1.5 max-w-md">
            {comOab.map((a, i) => (
              <div key={i} className="px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
                {a.nome} — OAB {a.oab_numero}/{a.oab_uf}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
