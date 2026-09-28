import React, { useEffect, useMemo, useState } from "react";
import {
  Archive, ArrowLeft, Download, FileText, Flag, Forward, ImageOff, Inbox,
  AlertTriangle, Mail, MailOpen, Paperclip, Pencil, RefreshCw, Reply, Search, Send,
  Settings, Trash2, X,
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

function chavePasta(pasta) {
  return `${pasta?.specialUse || ""} ${(pasta?.flags || []).join(" ")} ${pasta?.path || ""} ${pasta?.name || ""}`.toLowerCase();
}

function tipoPasta(pasta) {
  const chave = chavePasta(pasta);
  const partes = new Set(chave.split(/[\\/\s.]+/).filter(Boolean));
  if (partes.has("inbox") || pasta.path?.toUpperCase() === "INBOX") return "inbox";
  if (partes.has("outbox") || chave.includes("caixa de saída")) return "outbox";
  if (partes.has("sent") || chave.includes("enviad")) return "sent";
  if (partes.has("draft") || partes.has("drafts") || chave.includes("rascunh")) return "drafts";
  if (partes.has("trash") || partes.has("deleted") || chave.includes("lixeira") || chave.includes("itens exclu")) return "trash";
  if (partes.has("junk") || partes.has("spam") || chave.includes("lixo eletrônico")) return "junk";
  if (partes.has("archive") || chave.includes("arquivo")) return "archive";
  if (partes.has("all") || chave.includes("todos os e-mails")) return "all";
  return "other";
}

function nomePasta(pasta) {
  const nomes = {
    inbox: "Caixa de entrada",
    outbox: "Caixa de saída",
    sent: "Enviados",
    drafts: "Rascunhos",
    trash: "Itens excluídos",
    junk: "Lixo eletrônico",
    archive: "Arquivo",
    all: "Todos os e-mails",
  };
  return nomes[tipoPasta(pasta)] || pasta.name || pasta.path;
}

function iconePasta(pasta) {
  const icones = {
    inbox: Inbox,
    outbox: Send,
    sent: Send,
    drafts: FileText,
    trash: Trash2,
    junk: Flag,
    archive: Archive,
    all: Mail,
  };
  return icones[tipoPasta(pasta)] || Mail;
}

function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Cache em memória: voltar pra uma pasta ou reabrir uma mensagem aparece na hora (e a lista
// ainda é atualizada por trás). Cada ida ao servidor abre uma conexão nova com o provedor.
const cacheListas = new Map();
const cacheMensagens = new Map();

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

function AcaoIcone({ icone: Icone, titulo, onClick, ativa = false, disabled = false }) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center h-9 w-9 rounded-md transition-colors disabled:opacity-40"
      style={{ color: ativa ? COLORS.brassText : COLORS.inkSoft, background: ativa ? "rgba(165,121,59,0.12)" : "transparent" }}
    >
      <Icone size={16} />
    </button>
  );
}

function ItemMensagem({ msg, ativo, onClick }) {
  const data = msg.data ? new Date(msg.data) : null;
  const hoje = data && new Date().toDateString() === data.toDateString();
  const dataCurta = data
    ? hoje
      ? data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[78px] text-left px-3.5 py-3 flex gap-2.5 border-b transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset"
      style={{ borderColor: COLORS.line, background: ativo ? "rgba(165,121,59,0.13)" : "transparent", outlineColor: COLORS.brass }}
    >
      <span className="w-2 shrink-0 pt-1.5">
        {!msg.lido && <span className="block h-2 w-2 rounded-full" style={{ background: COLORS.brass }} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px]" style={{ color: COLORS.ink, fontWeight: msg.lido ? 400 : 700 }}>
            {msg.de?.nome || msg.de?.email || "(sem remetente)"}
          </span>
          <span className="text-[11px] shrink-0" style={{ color: COLORS.slate }}>{dataCurta}</span>
        </span>
        <span className="mt-1 block truncate text-[13px]" style={{ color: COLORS.ink, fontWeight: msg.lido ? 400 : 600 }}>
          {msg.assunto || "(sem assunto)"}
        </span>
        <span className="mt-1 flex h-4 items-center gap-2">
          {msg.tem_anexo && <Paperclip size={12} style={{ color: COLORS.slate }} />}
          {msg.sinalizado && <Flag size={12} fill={COLORS.brass} style={{ color: COLORS.brassText }} />}
        </span>
      </span>
    </button>
  );
}

function PainelLeitura({ conta, pasta, uid, resumo, atualizarItens, onVoltarMobile, onResponder, onEncaminhar, onAcao, pastas, acaoEmAndamento }) {
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState("");
  const [mostrarImagens, setMostrarImagens] = useState(false);
  const [baixando, setBaixando] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setErro("");
    setMostrarImagens(false);
    const chave = `${conta.id}|${pasta}|${uid}`;
    const emCache = cacheMensagens.get(chave);
    setMsg(emCache ?? null);
    if (emCache) return () => { cancelado = true; };
    chamarProxy({ acao: "ler", conta_id: conta.id, uid, pasta })
      .then((d) => {
        cacheMensagens.set(chave, d);
        if (!cancelado) {
          setMsg(d);
          atualizarItens((atuais) => atuais.map((item) => item.uid === uid ? { ...item, lido: true } : item));
        }
      })
      .catch((err) => { if (!cancelado) setErro(err.message); });
    return () => { cancelado = true; };
  }, [conta.id, pasta, uid, atualizarItens]);

  const baixarAnexo = async (a) => {
    setBaixando(a.partId);
    try {
      const dados = await chamarProxy({ acao: "anexo", conta_id: conta.id, uid, pasta, partId: a.partId });
      const blob = base64ParaBlob(dados.base64, a.mime || dados.mime);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = a.nome || dados.nome;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert(`Não consegui baixar: ${err.message}`);
    } finally {
      setBaixando(null);
    }
  };

  const temPasta = (...termos) => pastas.some((p) => {
    const chave = chavePasta(p);
    return termos.some((termo) => chave.includes(termo));
  });

  if (erro) return <div className="p-6 text-sm" style={{ color: COLORS.wine }}>{erro}</div>;
  if (!msg) return <div className="p-6 text-sm" style={{ color: COLORS.slate }}>Carregando mensagem...</div>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b px-3 py-2" style={{ borderColor: COLORS.line }}>
        {onVoltarMobile && <AcaoIcone icone={ArrowLeft} titulo="Voltar para mensagens" onClick={onVoltarMobile} />}
        <AcaoIcone icone={Archive} titulo="Arquivar" disabled={acaoEmAndamento} onClick={() => onAcao("archive")} />
        {temPasta("\\junk", "\\spam", "junk", "spam", "lixo eletrônico") && <AcaoIcone icone={Flag} titulo="Mover para lixo eletrônico" disabled={acaoEmAndamento} onClick={() => onAcao("junk")} />}
        <AcaoIcone icone={Trash2} titulo="Excluir" disabled={acaoEmAndamento} onClick={() => onAcao("delete")} />
        <AcaoIcone icone={Flag} titulo={resumo?.sinalizado ? "Remover sinalizador" : "Sinalizar"} ativa={resumo?.sinalizado} disabled={acaoEmAndamento} onClick={() => onAcao("flag")} />
        <AcaoIcone icone={MailOpen} titulo={resumo?.lido ? "Marcar como não lido" : "Marcar como lido"} disabled={acaoEmAndamento} onClick={() => onAcao("read")} />
        <span className="flex-1" />
        <AcaoIcone icone={Reply} titulo="Responder" onClick={() => onResponder(msg)} />
        <AcaoIcone icone={Forward} titulo="Encaminhar" onClick={() => onEncaminhar(msg)} />
      </div>

      <div className="border-b px-5 py-4" style={{ borderColor: COLORS.line }}>
        <h2 className="break-words text-lg font-semibold" style={{ color: COLORS.ink }}>{msg.assunto || "(sem assunto)"}</h2>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0 text-xs" style={{ color: COLORS.slate }}>
            <p className="truncate"><strong style={{ color: COLORS.ink }}>{msg.de?.nome || msg.de?.email || "(sem remetente)"}</strong>{msg.de?.nome && msg.de?.email ? ` <${msg.de.email}>` : ""}</p>
            <p className="mt-1 truncate">Para: {(msg.para ?? []).map((p) => p.email ?? p).join(", ") || conta.endereco}</p>
            {msg.cc?.length > 0 && <p className="mt-1 truncate">Cc: {msg.cc.map((p) => p.email ?? p).join(", ")}</p>}
          </div>
          <time className="shrink-0 text-[11px]" style={{ color: COLORS.slate }}>{formatData(msg.data)}</time>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
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
          <pre className="px-5 py-5 text-sm whitespace-pre-wrap" style={{ color: COLORS.ink, fontFamily: "inherit" }}>{msg.texto || "Esta mensagem não tem texto no corpo."}</pre>
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
  const [pastas, setPastas] = useState([]);
  const [pasta, setPasta] = useState("INBOX");
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [carregandoPastas, setCarregandoPastas] = useState(false);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(false);
  const [erro, setErro] = useState("");
  const [uidSelecionado, setUidSelecionado] = useState(null);
  const [painelMobile, setPainelMobile] = useState("lista");
  const [compose, setCompose] = useState(null); // null | { mode, prefill }

  useEffect(() => {
    if (contas.length && !contaId) setContaId(contas[0].id);
  }, [contas, contaId]);

  const conta = contas.find((c) => c.id === contaId);

  useEffect(() => {
    if (!conta) return;
    let cancelado = false;
    setCarregandoPastas(true);
    chamarProxy({ acao: "pastas", conta_id: conta.id })
      .then((res) => {
        if (cancelado) return;
        const disponiveis = (res.pastas || []).filter((p) => !p.noSelect);
        setPastas(disponiveis);
        const entrada = disponiveis.find((p) => chavePasta(p).includes("\\inbox"))
          || disponiveis.find((p) => p.path?.toUpperCase() === "INBOX");
        setPasta((atual) => disponiveis.some((p) => p.path === atual) ? atual : entrada?.path || "INBOX");
      })
      .catch((err) => { if (!cancelado) setErro(err.message); })
      .finally(() => { if (!cancelado) setCarregandoPastas(false); });
    return () => { cancelado = true; };
  }, [conta?.id]);

  useEffect(() => {
    if (!conta) return;
    let cancelado = false;
    const chaveLista = `${conta.id}|${pasta}`;
    const emCache = !busca && cacheListas.get(chaveLista);
    setCarregando(!emCache);
    setErro("");
    setItens(emCache ? emCache.itens : []);
    setCursor(emCache ? emCache.cursor : null);
    setUidSelecionado(null);
    const timer = window.setTimeout(async () => {
      try {
        const res = await chamarProxy({ acao: "listar", conta_id: conta.id, pasta, busca });
        if (!busca) cacheListas.set(chaveLista, { itens: res.itens || [], cursor: res.proximoCursor ?? null });
        if (!cancelado) {
          setItens(res.itens || []);
          setCursor(res.proximoCursor ?? null);
        }
      } catch (err) {
        if (!cancelado) setErro(err.message);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }, busca ? 350 : 0);
    return () => { cancelado = true; window.clearTimeout(timer); };
  }, [conta?.id, pasta, busca]);

  const carregarLista = async (append = false) => {
    if (!conta) return;
    setCarregando(true);
    setErro("");
    try {
      const res = await chamarProxy({
        acao: "listar", conta_id: conta.id, pasta, busca,
        antesDeUid: append ? cursor : undefined,
      });
      setItens((atuais) => append ? [...atuais, ...(res.itens || [])] : res.itens || []);
      setCursor(res.proximoCursor ?? null);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const pastaEspecial = (...termos) => pastas.find((p) => {
    const chave = chavePasta(p);
    return termos.some((termo) => chave.includes(termo));
  });

  const executarAcaoMensagem = async (tipo) => {
    const resumo = itens.find((item) => item.uid === uidSelecionado);
    if (!conta || !resumo) return;
    setAcaoEmAndamento(true);
    setErro("");
    try {
      if (tipo === "archive" || tipo === "delete" || tipo === "junk") {
        if (tipo === "junk") {
          const destino = pastaEspecial("\\junk", "\\spam", "junk", "spam", "lixo eletrônico");
          if (!destino) throw new Error("Esta conta não disponibiliza a pasta de spam.");
          await chamarProxy({ acao: "mover", conta_id: conta.id, uid: resumo.uid, pasta, destino: destino.path });
        } else {
          const naLixeira = !!pastas.find((p) => p.path === pasta && /\\trash|trash|lixeira|exclu/.test(chavePasta(p)));
          if (tipo === "delete" && naLixeira && !confirm("Excluir esta mensagem para sempre? Não dá para desfazer.")) return;
          await chamarProxy({ acao: tipo === "archive" ? "arquivar" : "excluir", conta_id: conta.id, uid: resumo.uid, pasta });
        }
        cacheListas.delete(`${conta.id}|${pasta}`);
        setItens((atuais) => atuais.filter((item) => item.uid !== resumo.uid));
        setUidSelecionado(null);
        setPainelMobile("lista");
      } else {
        const estado = tipo === "read"
          ? resumo.lido ? "nao_lido" : "lido"
          : resumo.sinalizado ? "nao_sinalizado" : "sinalizado";
        await chamarProxy({ acao: "marcar", conta_id: conta.id, uid: resumo.uid, pasta, estado });
        setItens((atuais) => atuais.map((item) => item.uid === resumo.uid
          ? { ...item, ...(tipo === "read" ? { lido: !item.lido } : { sinalizado: !item.sinalizado }) }
          : item));
      }
    } catch (err) {
      setErro(err.message);
    } finally {
      setAcaoEmAndamento(false);
    }
  };

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
        subtitle={conta?.nome || "Caixa de e-mail"}
        action={
          <button onClick={() => setCompose({ mode: "novo" })} className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
            <Pencil size={14} /> Novo e-mail
          </button>
        }
      />

      {conta?.status === "erro_auth" && (
        <div className="mb-4 px-4 py-3 rounded-md text-xs flex items-center gap-2" style={{ background: "rgba(155,34,38,0.08)", color: COLORS.wine }}>
          <AlertTriangle size={14} /> Senha mudou? Reconecte essa caixa em Configurações → Caixas de e-mail.
        </div>
      )}

      <Card className="!p-0 overflow-hidden" style={{ height: "72vh", minHeight: 480 }}>
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: COLORS.line, background: COLORS.paperRaised }}>
            <AcaoIcone icone={Mail} titulo="Pastas e contas" onClick={() => setPainelMobile("pastas")} />
            <div className="min-w-0 flex-1">
              <label className="sr-only" htmlFor="email-account">Conta de e-mail</label>
              <select
                id="email-account"
                value={contaId || ""}
                onChange={(e) => { setContaId(e.target.value); setPainelMobile("lista"); }}
                className="max-w-full bg-transparent text-sm font-semibold outline-none"
                style={{ color: COLORS.ink }}
              >
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.endereco}</option>)}
              </select>
            </div>
            <label className="sr-only" htmlFor="email-folder">Pasta de e-mail</label>
            <select
              id="email-folder"
              value={pasta}
              onChange={(e) => { setPasta(e.target.value); setPainelMobile("lista"); }}
              className="h-9 max-w-[145px] rounded-md border bg-white px-2 text-xs font-semibold outline-none lg:hidden"
              style={{ borderColor: COLORS.line, color: COLORS.ink }}
            >
              {(pastas.length ? pastas : [{ path: "INBOX", name: "INBOX", specialUse: "\\Inbox" }]).map((p) => (
                <option key={p.path} value={p.path}>{nomePasta(p)}</option>
              ))}
            </select>
            <div className="relative hidden sm:block sm:w-56 md:w-72">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.slate }} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nesta pasta" aria-label="Buscar nesta pasta" className="h-9 w-full rounded-md border bg-white pl-9 pr-3 text-sm outline-none focus:ring-2" style={{ borderColor: COLORS.line, color: COLORS.ink, "--tw-ring-color": COLORS.brass }} />
            </div>
            <AcaoIcone icone={RefreshCw} titulo="Atualizar mensagens" disabled={carregando} onClick={() => carregarLista(false)} />
          </div>

          <div className="relative flex min-h-0 flex-1">
            {erro && <div className="absolute inset-x-0 top-0 z-10 px-3 py-2 text-xs" style={{ background: "#fff2ef", color: COLORS.wine }}>{erro}</div>}

            <aside className={`w-full shrink-0 overflow-y-auto border-r lg:block lg:w-[190px] xl:w-[220px] ${painelMobile === "pastas" ? "block" : "hidden"}`} style={{ borderColor: COLORS.line, background: COLORS.paper }}>
              <div className="border-b px-4 py-3 lg:hidden" style={{ borderColor: COLORS.line }}>
                <button onClick={() => setPainelMobile("lista")} className="flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.ink }}><ArrowLeft size={15} /> Voltar para mensagens</button>
              </div>
              <div className="px-3 pb-3 pt-4">
                <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: COLORS.slate }}>Pastas</p>
                {carregandoPastas && <p className="px-2 py-2 text-xs" style={{ color: COLORS.slate }}>Carregando pastas...</p>}
                {(pastas.length ? pastas : [{ path: "INBOX", name: "INBOX", specialUse: "\\Inbox" }])
                  .slice()
                  .sort((a, b) => {
                    const ordem = ["inbox", "sent", "outbox", "drafts", "archive", "junk", "trash", "all"];
                    const indice = (p) => ordem.indexOf(tipoPasta(p));
                    const ia = indice(a), ib = indice(b);
                    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || nomePasta(a).localeCompare(nomePasta(b), "pt-BR");
                  })
                  .map((p) => {
                    const Icone = iconePasta(p);
                    const selecionada = pasta === p.path;
                    return (
                      <button key={p.path} onClick={() => { setPasta(p.path); setPainelMobile("lista"); }} className="mb-0.5 flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors" style={{ background: selecionada ? "rgba(27,51,40,0.09)" : "transparent", color: selecionada ? COLORS.ink : COLORS.inkSoft, fontWeight: selecionada ? 700 : 400 }}>
                        <Icone size={15} /> <span className="truncate">{nomePasta(p)}</span>
                      </button>
                    );
                  })}
              </div>
            </aside>

            <section className={`w-full min-w-0 shrink-0 overflow-hidden border-r lg:flex lg:w-[300px] xl:w-[350px] lg:flex-col ${painelMobile === "lista" ? "flex flex-col" : "hidden"}`} style={{ borderColor: COLORS.line, background: COLORS.paperRaised }} aria-label="Lista de mensagens">
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: COLORS.line }}>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold" style={{ color: COLORS.ink }}>{nomePasta(pastas.find((p) => p.path === pasta) || { path: pasta, name: pasta })}</h2>
                  <p className="text-[11px]" style={{ color: COLORS.slate }}>{itens.length}{cursor ? "+" : ""} mensagens</p>
                </div>
                <button onClick={() => setPainelMobile("pastas")} className="rounded p-2 lg:hidden" title="Abrir pastas" style={{ color: COLORS.slate }}><Inbox size={16} /></button>
              </div>
              <div className="border-b px-3 py-2 sm:hidden" style={{ borderColor: COLORS.line }}>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.slate }} />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nesta pasta" aria-label="Buscar nesta pasta" className="h-9 w-full rounded-md border bg-white pl-9 pr-3 text-sm" style={{ borderColor: COLORS.line, color: COLORS.ink }} />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {!erro && itens.length === 0 && !carregando && <p className="px-4 py-8 text-center text-xs" style={{ color: COLORS.slate }}>{busca ? "Nenhuma mensagem encontrada." : "Esta pasta está vazia."}</p>}
                {itens.map((msg) => (
                  <ItemMensagem key={msg.uid} msg={msg} ativo={msg.uid === uidSelecionado} onClick={() => {
                    setUidSelecionado(msg.uid);
                    setPainelMobile("leitura");
                    setItens((atuais) => atuais.map((item) => item.uid === msg.uid ? { ...item, lido: true } : item));
                  }} />
                ))}
                {carregando && <p className="px-4 py-3 text-center text-xs" style={{ color: COLORS.slate }}>Carregando mensagens...</p>}
                {cursor && !carregando && <button onClick={() => carregarLista(true)} className="w-full px-4 py-3 text-xs font-semibold" style={{ color: COLORS.brassText }}>Carregar mais</button>}
              </div>
            </section>

            <section className={`min-w-0 flex-1 lg:flex lg:flex-col ${painelMobile === "leitura" ? "flex flex-col" : "hidden"}`} aria-label="Leitura da mensagem">
              {uidSelecionado ? (
                <PainelLeitura
                  key={`${conta?.id}-${pasta}-${uidSelecionado}`}
                  conta={conta}
                  pasta={pasta}
                  uid={uidSelecionado}
                  atualizarItens={setItens}
                  resumo={itens.find((item) => item.uid === uidSelecionado)}
                  pastas={pastas}
                  acaoEmAndamento={acaoEmAndamento}
                  onAcao={executarAcaoMensagem}
                  onVoltarMobile={() => setPainelMobile("lista")}
                  onResponder={(msg) => setCompose({ mode: "responder", prefill: {
                    para: msg.de?.email ?? "",
                    assunto: msg.assunto?.startsWith("Re:") ? msg.assunto : `Re: ${msg.assunto ?? ""}`,
                    texto: `\n\nEm ${formatData(msg.data)}, ${msg.de?.nome || msg.de?.email} escreveu:\n${(msg.texto || "").split("\n").map((l) => `> ${l}`).join("\n")}`,
                    inReplyTo: msg.message_id,
                    references: msg.message_id,
                  }})}
                  onEncaminhar={(msg) => setCompose({ mode: "encaminhar", prefill: {
                    assunto: msg.assunto?.startsWith("Fwd:") ? msg.assunto : `Fwd: ${msg.assunto ?? ""}`,
                    texto: `\n\n---------- Mensagem encaminhada ----------\nDe: ${msg.de?.nome || msg.de?.email}\nAssunto: ${msg.assunto ?? ""}\nData: ${formatData(msg.data)}\n\n${msg.texto ?? ""}`,
                  }})}
                />
              ) : <div className="hidden h-full items-center justify-center text-sm lg:flex" style={{ color: COLORS.slate }}>Selecione uma mensagem para ler.</div>}
            </section>
          </div>
        </div>
      </Card>

      {compose && conta && (
        <ComposeModal conta={conta} prefill={compose.prefill} onClose={() => setCompose(null)} onEnviado={() => { setCompose(null); carregarLista(false); }} />
      )}
    </div>
  );
}
