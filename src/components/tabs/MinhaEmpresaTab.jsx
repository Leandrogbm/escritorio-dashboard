import React, { useState } from "react";
import { Building2 } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import { COLORS } from "../../lib/theme.js";
import { buscarEnderecoPorCep } from "../../lib/viaCep.js";
import { formatDocumento } from "../../lib/documento.js";
import { supabase } from "../../lib/supabaseClient.js";

// Perfil da própria empresa: nome, CNPJ e endereço — editável por admin/sócio DAQUELA
// empresa (RLS organizations_self_upd). Plano/billing ficam de fora de propósito (só o
// platform admin mexe nisso — trigger no banco trava essas colunas mesmo por fora da UI;
// CNPJ não é mais protegido, dá pra empresa preencher o próprio). Upload de logo tirado por pedido.
export default function MinhaEmpresaTab({ profile, onAtualizado }) {
  const org = profile.organizations ?? {};
  const [form, setForm] = useState({
    nome: org.nome ?? "",
    cnpj: org.cnpj ?? "",
    inscricao_municipal: org.inscricao_municipal ?? "",
    aliquota_iss: org.aliquota_iss ?? "",
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
    const payload = { ...form, cnpj: form.cnpj || null, aliquota_iss: form.aliquota_iss === "" ? null : Number(form.aliquota_iss) };
    const { error } = await supabase.from("organizations").update(payload).eq("id", profile.org_id);
    setSalvando(false);
    if (error) return setMsg(error.code === "23505" ? "Esse CNPJ já está cadastrado em outra empresa." : error.message);
    setMsg("Salvo.");
    onAtualizado?.();
  };

  const inputStyle = { border: `1px solid ${COLORS.line}`, color: COLORS.ink };

  return (
    <div>
      <SectionTitle icon={Building2} title="Minha Empresa" subtitle="Nome e endereço do escritório" />

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
              Inscrição Municipal
              <input value={form.inscricao_municipal} onChange={(e) => campo("inscricao_municipal", { inscricao_municipal: e.target.value })} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
              Alíquota de ISS (%)
              <input type="number" step="0.01" min="0" max="100" value={form.aliquota_iss} onChange={(e) => campo("aliquota_iss", { aliquota_iss: e.target.value })} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
            </label>
          </div>
          <p className="text-xs -mt-2" style={{ color: COLORS.slate }}>
            Esses dois campos são pra quando a emissão de nota fiscal for ligada (Financeiro → gerar nota).
          </p>

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
    </div>
  );
}
