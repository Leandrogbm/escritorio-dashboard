import React, { useState } from "react";
import { Mail, Plus, RefreshCw, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { supabase } from "../lib/supabaseClient.js";
import { ROLES } from "../config/permissions.js";

const inputStyle = { border: `1px solid ${COLORS.line}`, color: COLORS.ink };
const labelStyle = { color: COLORS.ink, fontWeight: 600 };
const hintStyle = { color: COLORS.slate, fontWeight: 400 };

// Presets cobrem os provedores que os clientes reais usam (Zoho é o do escritório piloto);
// "Outro" deixa os 4 campos manuais pra qualquer webmail com IMAP/SMTP padrão.
const PRESETS = {
  // Conta de domínio próprio (organização) no Zoho usa os servidores "pro"; imap/smtp.zoho.com é só pra conta pessoal.
  zoho: { label: "Zoho Mail (domínio próprio)", imap_host: "imappro.zoho.com", imap_port: 993, smtp_host: "smtppro.zoho.com", smtp_port: 465 },
  zoho_pessoal: { label: "Zoho Mail (conta pessoal @zoho.com)", imap_host: "imap.zoho.com", imap_port: 993, smtp_host: "smtp.zoho.com", smtp_port: 465 },
  hostinger: { label: "Hostinger", imap_host: "imap.hostinger.com", imap_port: 993, smtp_host: "smtp.hostinger.com", smtp_port: 465 },
  locaweb: { label: "Locaweb", imap_host: "email-ssl.com.br", imap_port: 993, smtp_host: "email-ssl.com.br", smtp_port: 465 },
  outro: { label: "Outro (manual)", imap_host: "", imap_port: 993, smtp_host: "", smtp_port: 465 },
};

async function chamarProxy(body) {
  const { data, error } = await supabase.functions.invoke("email-proxy", { body });
  if (error) throw new Error((await error.context?.json?.().catch(() => null))?.error ?? error.message);
  return data;
}

function vazio(slot) {
  return { id: null, slot, provider: "zoho", nome: "", endereco: "", usuario: "", senha: "", cargos: [], ...PRESETS.zoho };
}

function CargosCheckbox({ cargos, onChange }) {
  return (
    <div className="flex flex-col gap-1.5 text-xs" style={hintStyle}>
      <span style={labelStyle}>Quem pode ver esta caixa</span>
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-1.5 opacity-60">
          <input type="checkbox" checked disabled /> Administrador(a)
        </label>
        {ROLES.filter((r) => r.key !== "admin").map((r) => (
          <label key={r.key} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={cargos.includes(r.key)}
              onChange={(e) => onChange(e.target.checked ? [...cargos, r.key] : cargos.filter((c) => c !== r.key))}
            />
            {r.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function ContaForm({ inicial, onSalvou, onCancelar }) {
  const [form, setForm] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const editando = !!inicial.id;

  const aplicarPreset = (provider) => {
    const p = PRESETS[provider] ?? PRESETS.outro;
    setForm((v) => ({ ...v, provider, imap_host: p.imap_host, imap_port: p.imap_port, smtp_host: p.smtp_host, smtp_port: p.smtp_port }));
  };

  const salvar = async (e) => {
    e.preventDefault();
    setErro("");
    if (!editando && !form.senha) return setErro("Senha é obrigatória pra conectar uma caixa nova.");
    setSalvando(true);
    try {
      await chamarProxy({
        acao: "salvar_conta",
        id: form.id ?? undefined,
        slot: form.slot,
        nome: form.nome,
        endereco: form.endereco,
        imap_host: form.imap_host,
        imap_port: Number(form.imap_port),
        smtp_host: form.smtp_host,
        smtp_port: Number(form.smtp_port),
        usuario: form.usuario || form.endereco,
        senha: form.senha || undefined,
        cargos: form.cargos,
      });
      // ponytail: nunca guarda a senha de volta no state depois de salvar — sai de cena
      // junto com o formulário fechando.
      onSalvou();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3 max-w-md pb-4">
      <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
        <span style={labelStyle}>Provedor</span>
        <select value={form.provider} onChange={(e) => aplicarPreset(e.target.value)} className="px-3 py-2 rounded-md text-sm" style={inputStyle}>
          {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
        <span style={labelStyle}>Nome de exibição</span> <span>(aparece como remetente)</span>
        <input required value={form.nome} onChange={(e) => setForm((v) => ({ ...v, nome: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
      </label>
      <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
        <span style={labelStyle}>Endereço de e-mail</span>
        <input required type="email" value={form.endereco} onChange={(e) => setForm((v) => ({ ...v, endereco: e.target.value, usuario: v.usuario || e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
      </label>
      <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
        <span style={labelStyle}>Usuário</span> <span>(login IMAP/SMTP, geralmente igual ao endereço)</span>
        <input value={form.usuario} onChange={(e) => setForm((v) => ({ ...v, usuario: e.target.value }))} placeholder={form.endereco} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
      </label>
      <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
        <span style={labelStyle}>Senha</span> <span>{editando ? "(deixe em branco pra manter a atual)" : ""} — se o provedor usa verificação em 2 etapas, use uma senha de app</span>
        <input type="password" autoComplete="new-password" value={form.senha} onChange={(e) => setForm((v) => ({ ...v, senha: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
      </label>
      {form.provider === "outro" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
            <span style={labelStyle}>Servidor IMAP</span>
            <input required value={form.imap_host} onChange={(e) => setForm((v) => ({ ...v, imap_host: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
            <span style={labelStyle}>Porta IMAP</span>
            <input required type="number" value={form.imap_port} onChange={(e) => setForm((v) => ({ ...v, imap_port: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
            <span style={labelStyle}>Servidor SMTP</span>
            <input required value={form.smtp_host} onChange={(e) => setForm((v) => ({ ...v, smtp_host: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
            <span style={labelStyle}>Porta SMTP</span>
            <input required type="number" value={form.smtp_port} onChange={(e) => setForm((v) => ({ ...v, smtp_port: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
          </label>
        </div>
      )}
      <CargosCheckbox cargos={form.cargos} onChange={(cargos) => setForm((v) => ({ ...v, cargos }))} />
      {erro && <p className="text-xs" style={{ color: COLORS.wine }}>{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={salvando} className="px-3.5 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
          {salvando ? "Testando e salvando..." : "Testar e salvar"}
        </button>
        <button type="button" onClick={onCancelar} className="px-3.5 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function statusBadge(status) {
  if (status === "ok") return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(30,132,73,0.12)", color: COLORS.success }}>Conectada</span>;
  if (status === "erro_auth") return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(155,34,38,0.1)", color: COLORS.wine }}>Erro de login</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(92,107,96,0.12)", color: COLORS.slate }}>Erro</span>;
}

function SlotCard({ slot, conta, onEditar, onRefresh }) {
  const [testando, setTestando] = useState(false);
  const [erroTeste, setErroTeste] = useState("");
  const [editando, setEditando] = useState(false);

  const testar = async () => {
    setTestando(true);
    setErroTeste("");
    try {
      const res = await chamarProxy({ acao: "testar", conta_id: conta.id });
      if (!res.ok) setErroTeste(res.erro ?? "Não conectou.");
      await onRefresh();
    } catch (err) {
      setErroTeste(err.message);
    } finally {
      setTestando(false);
    }
  };

  const remover = async () => {
    if (!confirm(`Desconectar a caixa "${conta.nome}"? Os e-mails já enviados por aqui continuam no histórico.`)) return;
    try {
      await chamarProxy({ acao: "remover_conta", conta_id: conta.id });
      await onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!conta) {
    return editando ? (
      <div style={{ borderTop: `1px solid ${COLORS.line}` }}>
        <ContaForm inicial={vazio(slot)} onSalvou={() => { setEditando(false); onRefresh(); }} onCancelar={() => setEditando(false)} />
      </div>
    ) : (
      <div className="py-4" style={{ borderTop: `1px solid ${COLORS.line}` }}>
        <button onClick={() => setEditando(true)} className="flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.brassText }}>
          <Plus size={15} /> Conectar caixa {slot}
        </button>
      </div>
    );
  }

  if (editando) {
    return (
      <div style={{ borderTop: `1px solid ${COLORS.line}` }}>
        <ContaForm
          inicial={{ ...conta, senha: "", provider: "outro" }}
          onSalvou={() => { setEditando(false); onRefresh(); }}
          onCancelar={() => setEditando(false)}
        />
      </div>
    );
  }

  return (
    <div className="py-3.5" style={{ borderTop: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold flex items-center gap-2" style={{ color: COLORS.ink }}>
            {conta.nome} {statusBadge(conta.status)}
          </p>
          <p className="text-xs truncate" style={{ color: COLORS.slate }}>{conta.endereco}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={testar} disabled={testando} title="Testar conexão" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.slate }}>
            <RefreshCw size={15} className={testando ? "animate-spin" : ""} />
          </button>
          <button onClick={() => setEditando(true)} title="Editar" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.slate }}>
            <Pencil size={15} />
          </button>
          <button onClick={remover} title="Desconectar" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.wine }}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {conta.status === "erro_auth" && (
        <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: COLORS.wine }}>
          <AlertTriangle size={12} /> Senha mudou? {conta.ultimo_erro ? `Erro: "${conta.ultimo_erro}". ` : ""}Clique em editar e reconecte.
        </p>
      )}
      {erroTeste && <p className="text-xs mt-2" style={{ color: COLORS.wine }}>{erroTeste}</p>}
    </div>
  );
}

export default function EmailContasSection({ orgId }) {
  const { data: contas, refresh } = useSupabaseTable("email_contas", {
    eq: orgId ? ["org_id", orgId] : undefined,
    orderBy: "slot",
    ascending: true,
  });

  return (
    <div>
      {[1, 2].map((slot) => (
        <SlotCard key={slot} slot={slot} conta={contas.find((c) => c.slot === slot)} onRefresh={refresh} />
      ))}
    </div>
  );
}
