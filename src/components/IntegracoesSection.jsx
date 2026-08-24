import React, { useEffect, useState } from "react";
import { PenTool, ListChecks, Wallet, MapPin } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { supabase } from "../lib/supabaseClient.js";

// Credenciais D4Sign são DA PRÓPRIA EMPRESA (cada escritório usa a conta dele) — ficam
// salvas em organizations, mesmas colunas que Minha Empresa já usa pro resto do perfil.
// Sem teste contra conta real (não temos credencial) — construído a partir da documentação
// oficial da D4Sign.
//
// Rótulo em linguagem simples pra quem não é técnico + o termo original entre parênteses
// (assim quem olhar a tela do provedor sabe qual campo bate com qual) + passo a passo de
// onde achar cada dado — pedido explícito do usuário depois de mostrar isso pra um cliente
// não-técnico que não reconheceu "tokenAPI"/"cryptKey".
//
// ponytail: Jusbrasil (captação automática de processo por OAB) foi removido — o cliente
// não tem o produto "Jusbrasil Soluções" (é um contrato B2B separado da conta pessoal dele),
// então a integração ficava sem uso real. Reintroduzir se/quando contratarem esse produto.
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
  const { data: orgRows, refresh: refreshOrg } = useSupabaseTable("organizations", {
    select: "d4sign_token,d4sign_crypt_key,d4sign_safe_uuid,asaas_token,asaas_ambiente", eq: orgId ? ["id", orgId] : undefined,
  });
  const org = orgRows[0];
  const [d4, setD4] = useState({ d4sign_token: "", d4sign_crypt_key: "", d4sign_safe_uuid: "" });
  const [salvandoD4, setSalvandoD4] = useState(false);
  const [asaas, setAsaas] = useState({ asaas_token: "", asaas_ambiente: "sandbox" });
  const [salvandoAsaas, setSalvandoAsaas] = useState(false);

  // carrega os valores salvos assim que a organização chega (fetch async)
  useEffect(() => {
    if (!org) return;
    setD4({ d4sign_token: org.d4sign_token ?? "", d4sign_crypt_key: org.d4sign_crypt_key ?? "", d4sign_safe_uuid: org.d4sign_safe_uuid ?? "" });
    setAsaas({ asaas_token: org.asaas_token ?? "", asaas_ambiente: org.asaas_ambiente ?? "sandbox" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.d4sign_token, org?.d4sign_crypt_key, org?.d4sign_safe_uuid, org?.asaas_token, org?.asaas_ambiente]);

  const salvarD4 = async (e) => {
    e.preventDefault();
    setSalvandoD4(true);
    const { error } = await supabase.from("organizations").update(d4).eq("id", orgId);
    setSalvandoD4(false);
    if (error) return alert(error.message);
    await refreshOrg();
  };

  const salvarAsaas = async (e) => {
    e.preventDefault();
    setSalvandoAsaas(true);
    const { error } = await supabase.from("organizations").update(asaas).eq("id", orgId);
    setSalvandoAsaas(false);
    if (error) return alert(error.message);
    await refreshOrg();
  };

  return (
    <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${COLORS.line}` }}>
      <p className="flex items-center gap-2 text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>
        <PenTool size={16} color={COLORS.brass} /> Assinatura eletrônica
      </p>
      <p className="text-xs mb-3" style={{ color: COLORS.slate }}>
        Pra mandar documento pra assinar sem sair da Actum, conecte a conta D4Sign do escritório aqui embaixo — são 3 códigos, você pega tudo dentro da conta D4Sign de vocês.
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

      {/* ponytail: Asaas construído e testado (function + webhook), mas o usuário pediu pra
          segurar em back log — não subir pro cliente ainda. UI escondida, código intacto
          (ver ROADMAP-comparativo.md). Reativar: tirar esse comentário e o "false &&" abaixo. */}
      {false && (
        <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${COLORS.line}` }}>
          <p className="flex items-center gap-2 text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>
            <Wallet size={16} color={COLORS.brass} /> Cobrança automática
          </p>
          <p className="text-xs mb-3" style={{ color: COLORS.slate }}>
            Conecte a conta Asaas do escritório pra gerar boleto/Pix/cartão de verdade em cada cobrança (Financeiro) — quando o cliente pagar, a cobrança vira "Pago" sozinha, sem precisar importar extrato.
          </p>

          <ComoConseguir passos={[
            <>Crie (ou entre na) conta em <strong>asaas.com</strong> com os dados do escritório.</>,
            <>No menu, vá em <strong>"Integrações" → "API"</strong> e copie a <strong>Chave de API</strong>.</>,
            <>Se quiser testar antes de usar de verdade, use o <strong>Ambiente de testes (sandbox)</strong> — a Asaas tem uma conta sandbox separada (sandbox.asaas.com), com chave de API própria.</>,
          ]} />

          <form onSubmit={salvarAsaas} className="flex flex-col gap-3 max-w-md">
            <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
              <span style={labelStyle}>Chave de API</span> <span>(em Integrações → API, na Asaas)</span>
              <input value={asaas.asaas_token} onChange={(e) => setAsaas((v) => ({ ...v, asaas_token: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
              <span style={labelStyle}>Ambiente</span>
              <select value={asaas.asaas_ambiente} onChange={(e) => setAsaas((v) => ({ ...v, asaas_ambiente: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={inputStyle}>
                <option value="sandbox">Testes (sandbox) — não gera cobrança real</option>
                <option value="producao">Produção — gera cobrança real</option>
              </select>
            </label>
            <button type="submit" disabled={salvandoAsaas} className="self-start px-3.5 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: salvandoAsaas ? 0.6 : 1 }}>
              {salvandoAsaas ? "Salvando..." : "Salvar"}
            </button>
          </form>
        </div>
      )}

      {/* ponytail: Captação de Leads (formulário público + mapa) construída e testada, mas
          em back log a pedido do usuário — escondida junto com o módulo "leads_captacao"
          (permissions.js) e o formulário público (App.jsx). Reativar: tirar o "false &&". */}
      {false && (
        <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${COLORS.line}` }}>
          <p className="flex items-center gap-2 text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>
            <MapPin size={16} color={COLORS.brass} /> Captação de leads no site
          </p>
          <p className="text-xs mb-3" style={{ color: COLORS.slate }}>
            Cole esse código no site do escritório (numa página ou seção de contato) pra mostrar o formulário de captação — os contatos aparecem em "Captação de Leads" no menu.
          </p>
          <pre className="px-3 py-3 rounded-md text-xs overflow-x-auto max-w-md" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
{`<iframe src="${window.location.origin}/?leadform=1&org=${orgId}" width="100%" height="640" style="border:0"></iframe>`}
          </pre>
        </div>
      )}
    </div>
  );
}
