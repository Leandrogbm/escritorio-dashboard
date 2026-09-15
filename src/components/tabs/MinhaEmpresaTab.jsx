import React, { useState } from "react";
import { Building2, CreditCard } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import AssinaturaModal from "../AssinaturaModal.jsx";
import { COLORS } from "../../lib/theme.js";
import { buscarEnderecoPorCep } from "../../lib/viaCep.js";
import { formatDocumento } from "../../lib/documento.js";
import { supabase } from "../../lib/supabaseClient.js";
import { planoPorValue, valorCobranca } from "../../config/planos.js";

const STATUS_LABEL = { pago: "Em dia", pendente: "Aguardando confirmação", atrasado: "Atrasado" };
const STATUS_COR = { pago: "success", pendente: "brass", atrasado: "wine" };

// Perfil da própria empresa: nome, CNPJ e endereço — editável por admin/sócio DAQUELA
// empresa (RLS organizations_self_upd). Plano/billing (colunas em si) ficam de fora do form
// de propósito — só o platform admin ou a Edge Function de assinatura mexem nelas (trigger no
// banco trava isso mesmo por fora da UI); a seção "Assinatura" abaixo só LÊ o plano atual e
// aciona as Edge Functions de assinar/trocar/cancelar, nunca dá update direto na tabela.
// CNPJ não é mais protegido, dá pra empresa preencher o próprio. Upload de logo tirado por pedido.
export default function MinhaEmpresaTab({ profile, onAtualizado }) {
  const org = profile.organizations ?? {};
  const podeAssinar = profile.role === "admin" || profile.role === "socio";
  const plano = planoPorValue(org.plano);
  const [modalAssinatura, setModalAssinatura] = useState(null); // 'assinar' | 'trocar' | 'cartao' | null
  const [cancelando, setCancelando] = useState(false);
  const [msgAssinatura, setMsgAssinatura] = useState("");

  const cancelarAssinatura = async () => {
    if (!confirm("Cancelar a assinatura? Ela continua ativa até o fim do ciclo já pago — depois disso a empresa volta pro plano grátis. Os dados já cadastrados continuam intactos.")) return;
    setCancelando(true);
    setMsgAssinatura("");
    const { data, error } = await supabase.functions.invoke("mercado-pago-cancelar-assinatura", { body: {} });
    setCancelando(false);
    if (error) {
      const corpo = await error.context?.json?.().catch(() => null);
      setMsgAssinatura(corpo?.error ?? error.message);
      return;
    }
    setMsgAssinatura(data?.message ?? "Assinatura cancelada.");
    onAtualizado?.();
  };

  const [form, setForm] = useState({
    nome: org.nome ?? "",
    cnpj: org.cnpj ?? "",
    cep: org.cep ?? "",
    logradouro: org.logradouro ?? "",
    numero: org.numero ?? "",
    complemento: org.complemento ?? "",
    bairro: org.bairro ?? "",
    cidade: org.cidade ?? "",
    uf: org.uf ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");

  const campo = (key, patch) => setForm((f) => ({ ...f, ...patch, [key]: patch?.[key] ?? f[key] }));

  const onCepBlur = async (e) => {
    const endereco = await buscarEnderecoPorCep(e.target.value);
    if (endereco) setForm((f) => ({ ...f, ...endereco }));
  };

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setMsg("");
    // cnpj é unique no banco — "" bateria com a "" de outra empresa que também deixou em
    // branco (unique não trata duas strings vazias como diferente, só NULL é sempre diferente).
    const { error } = await supabase.from("organizations").update({ ...form, cnpj: form.cnpj || null }).eq("id", profile.org_id);
    setSalvando(false);
    if (error) return setMsg(error.code === "23505" ? "Esse CNPJ já está cadastrado em outra empresa." : error.message);
    setMsg("Salvo.");
    onAtualizado?.();
  };

  const inputStyle = { border: `1px solid ${COLORS.line}`, color: COLORS.ink };
  const botaoSecundario = { border: `1px solid ${COLORS.line}`, color: COLORS.ink };

  return (
    <div>
      <SectionTitle icon={Building2} title="Minha Empresa" subtitle="Nome, endereço e assinatura do escritório" />

      {podeAssinar && (
        <Card className="max-w-xl mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard size={16} color={COLORS.brass} />
            <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 15, color: COLORS.ink }}>Assinatura</p>
          </div>

          <p className="text-sm mb-1" style={{ color: COLORS.ink }}>
            Plano atual: <strong>{plano?.label ?? org.plano ?? "—"}</strong>
            {plano?.valor
              ? org.assinatura_ciclo === "anual"
                ? ` — R$${valorCobranca(plano.valor, "anual")}/ano (cobrança anual)`
                : ` — R$${plano.valor}/mês`
              : ""}
          </p>
          {org.plano && org.plano !== "gratis" && (
            <p className="text-xs mb-3" style={{ color: COLORS[STATUS_COR[org.status_pagamento]] ?? COLORS.slate }}>
              Situação de pagamento: {STATUS_LABEL[org.status_pagamento] ?? org.status_pagamento}
            </p>
          )}
          {org.cancelamento_agendado_para && (
            <p className="text-xs mb-3" style={{ color: COLORS.brassText }}>
              Cancelamento agendado — acesso ao plano pago continua até {new Date(org.cancelamento_agendado_para).toLocaleDateString("pt-BR")}, depois volta pro grátis.
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-1">
            {(!org.plano || org.plano === "gratis") && (
              <button onClick={() => setModalAssinatura("assinar")} className="px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.brass, color: "#fff" }}>
                Assinar um plano
              </button>
            )}
            {org.plano && org.plano !== "gratis" && !org.cancelamento_agendado_para && (
              <>
                <button onClick={() => setModalAssinatura("trocar")} disabled={org.status_pagamento !== "pago"} className="px-3 py-2 rounded-md text-sm font-semibold" style={{ ...botaoSecundario, opacity: org.status_pagamento !== "pago" ? 0.5 : 1 }}>
                  Trocar de plano
                </button>
                <button onClick={() => setModalAssinatura("cartao")} className="px-3 py-2 rounded-md text-sm font-semibold" style={botaoSecundario}>
                  Atualizar forma de pagamento
                </button>
                <button onClick={cancelarAssinatura} disabled={cancelando} className="px-3 py-2 rounded-md text-sm font-semibold" style={{ ...botaoSecundario, color: COLORS.wine, opacity: cancelando ? 0.6 : 1 }}>
                  {cancelando ? "Cancelando..." : "Cancelar assinatura"}
                </button>
              </>
            )}
          </div>

          {org.plano && org.plano !== "gratis" && org.status_pagamento === "pendente" && (
            <p className="text-xs mt-3" style={{ color: COLORS.slate }}>
              Aguardando o Mercado Pago confirmar o pagamento — atualiza sozinho em instantes.
            </p>
          )}
          {msgAssinatura && <p className="text-xs mt-3" style={{ color: COLORS.slate }}>{msgAssinatura}</p>}
        </Card>
      )}

      <Card className="max-w-xl">
        <form onSubmit={salvar} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
            Nome da empresa
            <input required value={form.nome} onChange={(e) => campo("nome", { nome: e.target.value })} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
          </label>

          <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
            CNPJ
            <input
              value={form.cnpj}
              placeholder="00.000.000/0000-00"
              onChange={(e) => campo("cnpj", { cnpj: formatDocumento("PJ", e.target.value) })}
              className="px-3 py-2 rounded-md text-sm" style={inputStyle}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
              CEP
              <input value={form.cep} onChange={(e) => campo("cep", { cep: e.target.value })} onBlur={onCepBlur} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
              UF
              <input value={form.uf} onChange={(e) => campo("uf", { uf: e.target.value })} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
            Endereço
            <input value={form.logradouro} onChange={(e) => campo("logradouro", { logradouro: e.target.value })} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
              Número
              <input value={form.numero} onChange={(e) => campo("numero", { numero: e.target.value })} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
              Complemento
              <input value={form.complemento} onChange={(e) => campo("complemento", { complemento: e.target.value })} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
              Bairro
              <input value={form.bairro} onChange={(e) => campo("bairro", { bairro: e.target.value })} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
              Cidade
              <input value={form.cidade} onChange={(e) => campo("cidade", { cidade: e.target.value })} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
            </label>
          </div>

          {msg && <p className="text-xs" style={{ color: msg === "Salvo." ? COLORS.success : COLORS.wine }}>{msg}</p>}

          <button type="submit" disabled={salvando} className="self-start mt-1 px-3.5 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </Card>

      {modalAssinatura && (
        <AssinaturaModal
          modo={modalAssinatura}
          planoAtual={org.plano}
          cicloAtual={org.assinatura_ciclo}
          onClose={() => setModalAssinatura(null)}
          onAtualizado={() => { setModalAssinatura(null); onAtualizado?.(); }}
        />
      )}
    </div>
  );
}
