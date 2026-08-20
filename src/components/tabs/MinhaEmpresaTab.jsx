import React, { useState } from "react";
import { Building2, Upload } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import { COLORS } from "../../lib/theme.js";
import { buscarEnderecoPorCep } from "../../lib/viaCep.js";
import { supabase } from "../../lib/supabaseClient.js";

// Perfil da própria empresa: nome, logo, endereço — editável por admin/sócio DAQUELA
// empresa (RLS organizations_self_upd). Plano/billing/CNPJ ficam de fora de propósito
// (só o platform admin mexe nisso — inclusive um trigger no banco trava essas colunas
// mesmo se alguém tentar mandar por fora da UI).
export default function MinhaEmpresaTab({ profile, onAtualizado }) {
  const org = profile.organizations ?? {};
  const [form, setForm] = useState({
    nome: org.nome ?? "",
    cep: org.cep ?? "",
    logradouro: org.logradouro ?? "",
    numero: org.numero ?? "",
    complemento: org.complemento ?? "",
    bairro: org.bairro ?? "",
    cidade: org.cidade ?? "",
    uf: org.uf ?? "",
  });
  // enquadramento da logo: zoom + posição (%), aplicado via object-position/transform —
  // não é um crop de verdade (não recorta o arquivo), só ajusta como ela é exibida.
  const [logoUrl, setLogoUrl] = useState(org.logo_url ?? "");
  const [enquadre, setEnquadre] = useState({ zoom: org.logo_zoom ?? 1, x: org.logo_pos_x ?? 50, y: org.logo_pos_y ?? 50 });
  const [salvandoEnquadre, setSalvandoEnquadre] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
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
    const { error } = await supabase.from("organizations").update(form).eq("id", profile.org_id);
    setSalvando(false);
    if (error) return setMsg(error.message);
    setMsg("Salvo.");
    onAtualizado?.();
  };

  const enviarLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoLogo(true);
    setMsg("");
    const ext = file.name.split(".").pop();
    const path = `${profile.org_id}/logo.${ext}`;
    const { error: upErr } = await supabase.storage.from("org-logos").upload(path, file, { upsert: true });
    if (upErr) { setEnviandoLogo(false); return setMsg(upErr.message); }
    const { data } = supabase.storage.from("org-logos").getPublicUrl(path);
    // cache-bust: mesmo nome de arquivo, senão o browser mostra a logo antiga do cache
    const logo_url = `${data.publicUrl}?v=${Date.now()}`;
    // logo nova reseta o enquadramento — zoom/posição antigos não fazem sentido pra outra imagem
    const reset = { zoom: 1, x: 50, y: 50 };
    const { error: updErr } = await supabase.from("organizations")
      .update({ logo_url, logo_zoom: reset.zoom, logo_pos_x: reset.x, logo_pos_y: reset.y })
      .eq("id", profile.org_id);
    setEnviandoLogo(false);
    if (updErr) return setMsg(updErr.message);
    setLogoUrl(logo_url);
    setEnquadre(reset);
    onAtualizado?.();
  };

  // onChange só atualiza a prévia (arrastar o slider dispara isso a cada pixel); o save de
  // verdade só roda quando solta o slider (onMouseUp/onTouchEnd/onKeyUp), senão vira uma
  // escrita no banco por frame de arraste.
  const ajustarEnquadre = (patch) => setEnquadre((e) => ({ ...e, ...patch }));
  const confirmarEnquadre = async () => {
    setSalvandoEnquadre(true);
    await supabase.from("organizations")
      .update({ logo_zoom: enquadre.zoom, logo_pos_x: enquadre.x, logo_pos_y: enquadre.y })
      .eq("id", profile.org_id);
    setSalvandoEnquadre(false);
    onAtualizado?.();
  };

  const inputStyle = { border: `1px solid ${COLORS.line}`, color: COLORS.ink };

  return (
    <div>
      <SectionTitle icon={Building2} title="Minha Empresa" subtitle="Nome, logo e endereço do escritório" />

      <Card className="max-w-xl">
        <div className="flex flex-col gap-4 mb-5 pb-5" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: COLORS.ink }}>
              {logoUrl
                ? <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: `${enquadre.x}% ${enquadre.y}%`, transform: `scale(${enquadre.zoom})` }}
                  />
                : <Building2 size={24} color={COLORS.paper} />}
            </div>
            <label className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm cursor-pointer" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
              <Upload size={14} /> {enviandoLogo ? "Enviando..." : "Trocar logo"}
              <input type="file" accept="image/*" className="hidden" disabled={enviandoLogo} onChange={enviarLogo} />
            </label>
          </div>

          {logoUrl && (
            <div className="flex flex-col gap-2 max-w-xs">
              <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
                Zoom
                <input
                  type="range" min="1" max="3" step="0.05" value={enquadre.zoom}
                  onChange={(e) => ajustarEnquadre({ zoom: Number(e.target.value) })}
                  onMouseUp={confirmarEnquadre} onTouchEnd={confirmarEnquadre} onKeyUp={confirmarEnquadre}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
                Posição horizontal
                <input
                  type="range" min="0" max="100" step="1" value={enquadre.x}
                  onChange={(e) => ajustarEnquadre({ x: Number(e.target.value) })}
                  onMouseUp={confirmarEnquadre} onTouchEnd={confirmarEnquadre} onKeyUp={confirmarEnquadre}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
                Posição vertical
                <input
                  type="range" min="0" max="100" step="1" value={enquadre.y}
                  onChange={(e) => ajustarEnquadre({ y: Number(e.target.value) })}
                  onMouseUp={confirmarEnquadre} onTouchEnd={confirmarEnquadre} onKeyUp={confirmarEnquadre}
                />
              </label>
              {salvandoEnquadre && <span className="text-xs" style={{ color: COLORS.slate }}>Salvando enquadramento...</span>}
            </div>
          )}
        </div>

        <form onSubmit={salvar} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
            Nome da empresa
            <input required value={form.nome} onChange={(e) => campo("nome", { nome: e.target.value })} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
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
    </div>
  );
}
