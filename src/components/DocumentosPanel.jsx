import React, { useState } from "react";
import { X, Upload, FileText, Trash2, Download, PenTool } from "lucide-react";
import Card from "./Card.jsx";
import Stamp from "./Stamp.jsx";
import { COLORS } from "../lib/theme.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { useEscClose } from "../hooks/useEscClose.js";
import { supabase } from "../lib/supabaseClient.js";

const ASSINATURA_TONE = { enviado: "warn", assinado_parcial: "warn", finalizado: "ok", cancelado: "urgent" };

const BUCKET = "documentos-processo";

function formatTamanho(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Bucket privado — link de download é uma URL assinada (expira), não link público direto.
export default function DocumentosPanel({ processo, orgId, profile, onClose }) {
  useEscClose(onClose);
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: documentos, insert, remove, refresh } = useSupabaseTable("documentos_processo", {
    select: "*", eq: orgEq, orderBy: "created_at", ascending: false,
  });
  const doProcesso = documentos.filter((d) => d.processo_id === processo.id);
  const { data: assinaturas, refresh: refreshAssinaturas } = useSupabaseTable("documentos_assinatura", {
    select: "documento_processo_id, status", eq: orgEq,
  });
  const assinaturaPorDoc = new Map(assinaturas.map((a) => [a.documento_processo_id, a]));
  const [enviando, setEnviando] = useState(false);
  const [enviandoAssinatura, setEnviandoAssinatura] = useState(null); // id do documento em envio
  const [erro, setErro] = useState("");

  const orgIdReal = orgId ?? profile?.org_id;

  const enviarArquivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reenviar o mesmo arquivo depois
    if (!file) return;
    setEnviando(true);
    setErro("");
    const path = `${orgIdReal}/${processo.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
    if (upErr) { setEnviando(false); return setErro(upErr.message); }
    try {
      await insert({
        processo_id: processo.id,
        nome_arquivo: file.name,
        storage_path: path,
        tamanho: file.size,
        tipo_mime: file.type,
        enviado_por: profile?.id ?? null,
      });
    } catch (err) {
      // metadado falhou — desfaz o upload pra não deixar arquivo órfão no bucket.
      await supabase.storage.from(BUCKET).remove([path]);
      setErro(err.message);
    }
    setEnviando(false);
  };

  const baixar = async (doc) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60);
    if (error) return alert(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const excluir = async (doc) => {
    if (!confirm(`Excluir "${doc.nome_arquivo}"?`)) return;
    await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    await remove(doc.id);
    await refresh();
  };

  const enviarParaAssinatura = async (doc) => {
    const nome = prompt("Nome do signatário:");
    if (!nome) return;
    const email = prompt("Email do signatário:");
    if (!email) return;
    setEnviandoAssinatura(doc.id);
    const { error } = await supabase.functions.invoke("d4sign-enviar", {
      body: { documentoId: doc.id, orgId, signatarios: [{ nome, email }] },
    });
    setEnviandoAssinatura(null);
    if (error) {
      alert((await error.context?.json?.().catch(() => null))?.error ?? error.message);
      return;
    }
    await refreshAssinaturas();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 16, color: COLORS.ink }}>{processo.numero}</p>
              <p className="text-xs" style={{ color: COLORS.slate }}>Documentos</p>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
          </div>

          <label className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm cursor-pointer w-fit mb-4" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
            <Upload size={14} /> {enviando ? "Enviando..." : "Enviar documento"}
            <input type="file" className="hidden" disabled={enviando} onChange={enviarArquivo} />
          </label>
          {erro && <p className="text-xs mb-3" style={{ color: COLORS.wine }}>{erro}</p>}

          <div className="flex flex-col gap-2">
            {doProcesso.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: COLORS.slate }}>Nenhum documento enviado ainda.</p>
            )}
            {doProcesso.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 rounded-md" style={{ border: `1px solid ${COLORS.line}` }}>
                <FileText size={16} color={COLORS.brass} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate" style={{ color: COLORS.ink }}>{d.nome_arquivo}</p>
                  <p className="text-xs" style={{ color: COLORS.slate }}>{formatTamanho(d.tamanho)} · {new Date(d.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                {assinaturaPorDoc.has(d.id) ? (
                  <Stamp tone={ASSINATURA_TONE[assinaturaPorDoc.get(d.id).status]}>{assinaturaPorDoc.get(d.id).status}</Stamp>
                ) : (
                  <button onClick={() => enviarParaAssinatura(d)} disabled={enviandoAssinatura === d.id} aria-label="Enviar pra assinatura" title="Enviar pra assinatura (D4Sign)" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.brass, opacity: enviandoAssinatura === d.id ? 0.5 : 1 }}>
                    <PenTool size={15} />
                  </button>
                )}
                <button onClick={() => baixar(d)} aria-label="Baixar" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.slate }}><Download size={15} /></button>
                <button onClick={() => excluir(d)} aria-label="Excluir" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.wine }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
