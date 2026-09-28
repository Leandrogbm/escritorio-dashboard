import React, { useEffect, useMemo, useState } from "react";
import {
  Mail, Paperclip, RefreshCw, ArrowLeft, Reply, Forward, Pencil, X, Send,
  Download, ImageOff, AlertTriangle, Settings,
} from "lucide-react";
import DOMPurify from "dompurify";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import { COLORS } from "../../lib/theme.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
import { useEscClose } from "../../hooks/useEscClose.js";
import { supabase } from "../../lib/supabaseClient.js";

// Links de e-mail sempre em aba nova, sem abrir mão do sandbox do iframe (o hook roda em
// cima do HTML já sanitizado, antes de virar srcDoc).
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITE_ANEXOS = 10 * 1024 * 1024;

async function chamarProxy(body) {
  const { data, error } = await supabase.functions.invoke("email-proxy", { body });
  if (error) throw new Error((await error.context?.json?.().catch(() => null))?.error ?? error.message);
  return data;
}

function formatData(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoAno = d.getFullYear() === hoje.getFullYear();
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: mesmoAno ? undefined : "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatTamanho(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function base64ParaBlob(base64, mime) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || "application/octet-stream" });
}

// Corpo do e-mail dentro de um iframe sandboxed sem allow-scripts/allow-same-origin —
// mesmo com HTML malicioso passando pelo DOMPurify por algum buraco, o iframe não roda JS
// nem lê cookies/storage da própria Actum. `mostrarImagens` relaxa o CSP interno pra
// permitir imagem remota (rastreamento de abertura é o motivo de vir bloqueado por padrão).
function CorpoHtml({ html, mostrarImagens }) {
  const limpo = useMemo(() => DOMPurify.sanitize(html, { ADD_ATTR: ["target"] }), [html]);
  const srcDoc = useMemo(() => `<!doctype html><html><head><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: cid: ${mostrarImagens ? "https:" : ""}; style-src 'unsafe-inline'; font-src data:;">
    <base target="_blank">
    <style>body{font-family:Inter,Arial,sans-serif;font-size:13px;color:#1B3328;word-wrap:break-word;margin:0;padding:12px}</style>
    </head><body>${limpo}</body></html>`, [limpo, mostrarImagens]);
  const [altura, setAltura] = useState(200);
  return (
    <iframe
      title="Corpo do e-mail"
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      style={{ width: "100%", height: altura, border: "none" }}
      onLoad={(e) => {
        try { setAltura(e.target.contentWindow.document.body.scrollHeight + 24); } catch { /* cross-origin por sandbox, ignora */ }
      }}
    />
  );
}

function ComposeModal({ conta, prefill, onClose, onEnviado }) {
  useEscClose(onClose, true);
  const [para, setPara] = useState(prefill?.para ?? "");
  const [cc, setCc] = useState(prefill?.cc ?? "");
  const [assunto, setAssunto] = useState(prefill?.assunto ?? "");
  const [texto, setTexto] = useState(prefill?.texto ?? "");
  const [anexos, setAnexos] = useState([]); // [{nome, mime, base64, tamanho}]
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const tamanhoTotal = anexos.reduce((s, a) => s + a.tamanho, 0);

  const parseEmails = (v) => v.split(",").map((s) => s.trim()).filter(Boolean);

  const adicionarArquivos = async (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const novos = await Promise.all(files.map(async (f) => ({ nome: f.name, mime: f.type || "application/octet-stream", tamanho: f.size, base64: await fileParaBase64(f) })));
    const total = tamanhoTotal + novos.reduce((s, a) => s + a.tamanho, 0);
    if (total > LIMITE_ANEXOS) return setErro("Anexos passaram de 10 MB no total — remova algum antes de enviar.");
    setErro("");
    setAnexos((v) => [...v, ...novos]);
  };

  const enviar = async (e) => {
    e.preventDefault();
    setErro("");
    const destinatarios = parseEmails(para);
    const copiados = parseEmails(cc);
    if (destinatarios.length === 0) return setErro("Informe ao menos um destinatário.");
    const invalidos = [...destinatarios, ...copiados].filter((em) => !EMAIL_RE.test(em));
    if (invalidos.length) return setErro(`E-mail inválido: ${invalidos.join(", ")}`);
    if (!assunto.trim()) return setErro("Assunto é obrigatório.");
    setEnviando(true);
    try {
      const html = `<div style="white-space:pre-wrap">${texto.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</div>`;
      await chamarProxy({
        acao: "enviar",
        conta_id: conta.id,
        para: destinatarios,
        cc: copiados.length ? copiados : undefined,
        assunto,
        texto,
        html,
        anexos: anexos.map(({ nome, mime, base64 }) => ({ nome, mime, base64 })),
        inReplyTo: prefill?.inReplyTo,
        references: prefill?.references,
      });
      onEnviado();
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(27,51,40,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-md" style={{ background: COLORS.paperRaised }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
          <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 600, color: COLORS.ink }}>
            {prefill?.mode === "responder" ? "Responder" : prefill?.mode === "encaminhar" ? "Encaminhar" : "Novo e-mail"}
          </p>
          <button onClick={onClose} style={{ color: COLORS.slate }}><X size={18} /></button>
        </div>
        <form onSubmit={enviar} className="flex flex-col gap-3 px-5 py-4">
          <p className="text-xs" style={{ color: COLORS.slate }}>De: {conta.nome} &lt;{conta.endereco}&gt;</p>
          <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
            <span style={{ color: COLORS.ink, fontWeight: 600 }}>Para</span> <span>(separe vários e-mails por vírgula)</span>
            <input required value={para} onChange={(e) => setPara(e.target.value)} className="px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
            <span style={{ color: COLORS.ink, fontWeight: 600 }}>Cc</span>
            <input value={cc} onChange={(e) => setCc(e.target.value)} className="px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: COLORS.slate }}>
            <span style={{ color: COLORS.ink, fontWeight: 600 }}>Assunto</span>
            <input required value={assunto} onChange={(e) => setAssunto(e.target.value)} className="px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }} />
          </label>
          <textarea required value={texto} onChange={(e) => setTexto(e.target.value)} rows={10} className="px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, fontFamily: "inherit" }} />
          <div>
            <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: COLORS.brassText }}>
              <Paperclip size={14} /> Anexar arquivo
              <input type="file" multiple className="hidden" onChange={adicionarArquivos} />
            </label>
            {anexos.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {anexos.map((a, i) => (
                  <li key={i} className="text-xs flex items-center justify-between gap-2" style={{ color: COLORS.slate }}>
                    <span className="truncate">{a.nome} · {formatTamanho(a.tamanho)}</span>
                    <button type="button" onClick={() => setAnexos((v) => v.filter((_, j) => j !== i))} style={{ color: COLORS.wine }}><X size={13} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {erro && <p className="text-xs" style={{ color: COLORS.wine }}>{erro}</p>}
          <div className="flex gap-2 mt-1">
            <button type="submit" disabled={enviando} className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: enviando ? 0.6 : 1 }}>
              <Send size={14} /> {enviando ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ItemMensagem({ msg, ativo, onClick }) {
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-3 flex items-start gap-2" style={{ borderTop: `1px solid ${COLORS.line}`, background: ativo ? "rgba(165,121,59,0.08)" : "transparent" }}>
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate flex items-center gap-1.5" style={{ color: COLORS.ink, fontWeight: msg.lido ? 400 : 700 }}>
          {msg.de?.nome || msg.de?.email || "(sem remetente)"}
          {msg.tem_anexo && <Paperclip size={12} color={COLORS.slate} />}
        </p>
        <p className="text-xs truncate" style={{ color: COLORS.ink, fontWeight: msg.lido ? 400 : 600 }}>{msg.assunto || "(sem assunto)"}</p>
      </div>
      <span className="text-xs shrink-0" style={{ color: COLORS.slate }}>{formatData(msg.data)}</span>
    </button>
  );
}

function PainelLeitura({ conta, uid, onVoltarMobile, onResponder, onEncaminhar }) {
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState("");
  const [mostrarImagens, setMostrarImagens] = useState(false);
  const [baixando, setBaixando] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setMsg(null);
    setErro("");
    setMostrarImagens(false);
    chamarProxy({ acao: "ler", conta_id: conta.id, uid })
      .then((d) => { if (!cancelado) setMsg(d); })
      .catch((err) => { if (!cancelado) setErro(err.message); });
    return () => { cancelado = true; };
  }, [conta.id, uid]);

  const baixarAnexo = async (a) => {
    setBaixando(a.partId);
    try {
      const dados = await chamarProxy({ acao: "anexo", conta_id: conta.id, uid, partId: a.partId });
      const blob = base64ParaBlob(dados.base64, dados.mime);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = dados.nome;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Não consegui baixar: ${err.message}`);
    } finally {
      setBaixando(null);
    }
  };

  if (erro) return <div className="p-6 text-sm" style={{ color: COLORS.wine }}>{erro}</div>;
  if (!msg) return <div className="p-6 text-sm" style={{ color: COLORS.slate }}>Carregando...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 flex items-start justify-between gap-3" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
        <div className="min-w-0">
          {onVoltarMobile && (
            <button onClick={onVoltarMobile} className="lg:hidden flex items-center gap-1 text-xs mb-2" style={{ color: COLORS.slate }}>
              <ArrowLeft size={14} /> Voltar
            </button>
          )}
          <p className="text-lg" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 600, color: COLORS.ink }}>{msg.assunto || "(sem assunto)"}</p>
          <p className="text-xs mt-1" style={{ color: COLORS.slate }}>
            De: {msg.de?.nome ? `${msg.de.nome} <${msg.de.email}>` : msg.de?.email} · {formatData(msg.data)}
          </p>
          <p className="text-xs" style={{ color: COLORS.slate }}>Para: {(msg.para ?? []).map((p) => p.email ?? p).join(", ")}</p>
          {msg.cc?.length > 0 && <p className="text-xs" style={{ color: COLORS.slate }}>Cc: {msg.cc.map((p) => p.email ?? p).join(", ")}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => onResponder(msg)} title="Responder" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.brassText }}><Reply size={16} /></button>
          <button onClick={() => onEncaminhar(msg)} title="Encaminhar" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.brassText }}><Forward size={16} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {msg.html ? (
          <>
            <div className="px-5 pt-3 flex items-center justify-end">
              <button onClick={() => setMostrarImagens((v) => !v)} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.slate }}>
                <ImageOff size={12} /> {mostrarImagens ? "Ocultar imagens" : "Mostrar imagens"}
              </button>
            </div>
            <div className="px-2">
              <CorpoHtml html={msg.html} mostrarImagens={mostrarImagens} />
            </div>
          </>
        ) : (
          <pre className="px-5 py-4 text-sm whitespace-pre-wrap" style={{ color: COLORS.ink, fontFamily: "inherit" }}>{msg.texto || "(sem conteúdo)"}</pre>
        )}
        {msg.truncado && <p className="px-5 pb-3 text-xs" style={{ color: COLORS.slate }}>Mensagem longa — conteúdo cortado.</p>}

        {msg.anexos?.length > 0 && (
          <div className="px-5 py-4 flex flex-wrap gap-2" style={{ borderTop: `1px solid ${COLORS.line}` }}>
            {msg.anexos.map((a) => (
              <button key={a.partId} onClick={() => baixarAnexo(a)} disabled={baixando === a.partId} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
                <Download size={12} /> {a.nome} {a.tamanho ? `(${formatTamanho(a.tamanho)})` : ""}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmailsTab({ orgId }) {
  const { data: contas, loading: carregandoContas } = useSupabaseTable("email_contas", {
    eq: orgId ? ["org_id", orgId] : undefined,
    orderBy: "slot",
    ascending: true,
  });
  const [contaId, setContaId] = useState(null);
  const [itens, setItens] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [uidSelecionado, setUidSelecionado] = useState(null);
  const [compose, setCompose] = useState(null); // null | { mode, prefill }

  useEffect(() => {
    if (contas.length && !contaId) setContaId(contas[0].id);
  }, [contas, contaId]);

  const conta = contas.find((c) => c.id === contaId);

  const carregarLista = async (append = false) => {
    if (!conta) return;
    setCarregando(true);
    setErro("");
    try {
      const res = await chamarProxy({ acao: "listar", conta_id: conta.id, antesDeUid: append ? cursor : undefined });
      setItens((v) => append ? [...v, ...res.itens] : res.itens);
      setCursor(res.proximoCursor ?? null);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    setUidSelecionado(null);
    setItens([]);
    setCursor(null);
    if (conta) carregarLista(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conta?.id]);

  if (carregandoContas) return <div className="p-6 text-sm" style={{ color: COLORS.slate }}>Carregando...</div>;

  if (contas.length === 0) {
    return (
      <div>
        <SectionTitle icon={Mail} title="Emails" subtitle="Leia e envie e-mail do escritório sem sair da Actum" />
        <Card className="max-w-lg">
          <p className="text-sm mb-3" style={{ color: COLORS.ink }}>Nenhuma caixa de e-mail conectada ainda.</p>
          <p className="text-xs mb-4" style={{ color: COLORS.slate }}>
            Conecte uma caixa (Zoho, Hostinger, Locaweb ou outra via IMAP/SMTP) em Configurações → Caixas de e-mail.
          </p>
          <p className="flex items-center gap-1.5 text-xs" style={{ color: COLORS.brassText }}><Settings size={13} /> Vá em Configurações pra conectar.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle
        icon={Mail}
        title="Emails"
        subtitle="Leia e envie e-mail do escritório sem sair da Actum"
        action={
          <button onClick={() => setCompose({ mode: "novo" })} className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
            <Pencil size={14} /> Novo e-mail
          </button>
        }
      />

      {contas.length > 1 && (
        <div className="flex gap-2 mb-4">
          {contas.map((c) => (
            <button
              key={c.id}
              onClick={() => setContaId(c.id)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: c.id === contaId ? COLORS.ink : "transparent",
                color: c.id === contaId ? "#fff" : COLORS.ink,
                border: `1px solid ${c.id === contaId ? COLORS.ink : COLORS.line}`,
              }}
            >
              {c.nome}
            </button>
          ))}
        </div>
      )}

      {conta?.status === "erro_auth" && (
        <div className="mb-4 px-4 py-3 rounded-md text-xs flex items-center gap-2" style={{ background: "rgba(155,34,38,0.08)", color: COLORS.wine }}>
          <AlertTriangle size={14} /> Senha mudou? Reconecte essa caixa em Configurações → Caixas de e-mail.
        </div>
      )}

      <Card className="!p-0 overflow-hidden" style={{ height: "70vh" }}>
        <div className="grid lg:grid-cols-[320px_1fr] h-full">
          <div className={`overflow-y-auto ${uidSelecionado ? "hidden lg:block" : ""}`} style={{ borderRight: `1px solid ${COLORS.line}` }}>
            <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
              <span className="text-xs" style={{ color: COLORS.slate }}>Caixa de entrada</span>
              <button onClick={() => carregarLista(false)} disabled={carregando} style={{ color: COLORS.slate }}>
                <RefreshCw size={14} className={carregando ? "animate-spin" : ""} />
              </button>
            </div>
            {erro && <p className="px-4 py-3 text-xs" style={{ color: COLORS.wine }}>{erro}</p>}
            {!erro && itens.length === 0 && !carregando && <p className="px-4 py-6 text-xs text-center" style={{ color: COLORS.slate }}>Nenhum e-mail aqui.</p>}
            {itens.map((msg) => (
              <ItemMensagem key={msg.uid} msg={msg} ativo={msg.uid === uidSelecionado} onClick={() => setUidSelecionado(msg.uid)} />
            ))}
            {cursor && (
              <div className="px-4 py-3 text-center">
                <button onClick={() => carregarLista(true)} disabled={carregando} className="text-xs font-semibold" style={{ color: COLORS.brassText }}>
                  {carregando ? "Carregando..." : "Carregar mais"}
                </button>
              </div>
            )}
          </div>

          <div className={uidSelecionado ? "" : "hidden lg:flex lg:items-center lg:justify-center"}>
            {uidSelecionado ? (
              <PainelLeitura
                conta={conta}
                uid={uidSelecionado}
                onVoltarMobile={() => setUidSelecionado(null)}
                onResponder={(msg) => setCompose({
                  mode: "responder",
                  prefill: {
                    para: msg.de?.email ?? "",
                    assunto: msg.assunto?.startsWith("Re:") ? msg.assunto : `Re: ${msg.assunto ?? ""}`,
                    texto: `\n\nEm ${formatData(msg.data)}, ${msg.de?.nome || msg.de?.email} escreveu:\n${(msg.texto || "").split("\n").map((l) => `> ${l}`).join("\n")}`,
                    inReplyTo: msg.message_id,
                    references: msg.message_id,
                  },
                })}
                onEncaminhar={(msg) => setCompose({
                  mode: "encaminhar",
                  prefill: {
                    assunto: msg.assunto?.startsWith("Fwd:") ? msg.assunto : `Fwd: ${msg.assunto ?? ""}`,
                    texto: `\n\n---------- Mensagem encaminhada ----------\nDe: ${msg.de?.nome || msg.de?.email}\nAssunto: ${msg.assunto ?? ""}\nData: ${formatData(msg.data)}\n\n${msg.texto ?? ""}`,
                  },
                })}
              />
            ) : (
              <p className="text-sm" style={{ color: COLORS.slate }}>Selecione um e-mail pra ler.</p>
            )}
          </div>
        </div>
      </Card>

      {compose && conta && (
        <ComposeModal conta={conta} prefill={compose.prefill} onClose={() => setCompose(null)} onEnviado={() => { setCompose(null); carregarLista(false); }} />
      )}
    </div>
  );
}
