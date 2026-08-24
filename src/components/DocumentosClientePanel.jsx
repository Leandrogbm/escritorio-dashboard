import React, { useState } from "react";
import { X, Upload, FileText, Trash2, Download } from "lucide-react";
import Card from "./Card.jsx";
import { COLORS } from "../lib/theme.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { useEscClose } from "../hooks/useEscClose.js";
import { supabase } from "../lib/supabaseClient.js";

const BUCKET = "documentos-cliente";

function formatTamanho(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Pasta de documentos do cliente (contrato de honorários já assinado, procuração, RG/CNPJ
// etc.) — mesmo padrão do GED de processo (DocumentosPanel.jsx), só que preso ao cliente,
// não a um processo específico. Bucket privado — link de download é assinado (expira).
export default function DocumentosClientePanel({ cliente, orgId, profile, onClose }) {
  useEscClose(onClose);
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: documentos, insert, remove, refresh } = useSupabaseTable("documentos_cliente", {
    select: "*", eq: orgEq, orderBy: "created_at", ascending: false,
  });
  const doCliente = documentos.filter((d) => d.cliente_id === cliente.id);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const orgIdReal = orgId ?? profile?.org_id;

  const enviarArquivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEnviando(true);
    setErro("");
    const path = `${orgIdReal}/${cliente.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
    if (upErr) { setEnviando(false); return setErro(upErr.message); }
    try {
      await insert({
        cliente_id: cliente.id,
        nome_arquivo: file.name,
        storage_path: path,
        tamanho: file.size,
        tipo_mime: file.type,
        enviado_por: profile?.id ?? null,
      });
    } catch (err) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card style={{ boxShadow: "0 20px 48px rgba(22,35,59,0.22)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 16, color: COLORS.ink }}>{cliente.nome}</p>
              <p className="text-xs" style={{ color: COLORS.slate }}>Documentos do cliente</p>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
          </div>

          <label className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm cursor-pointer w-fit mb-4" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
            <Upload size={14} /> {enviando ? "Enviando..." : "Enviar documento"}
            <input type="file" className="hidden" disabled={enviando} onChange={enviarArquivo} />
          </label>
          {erro && <p className="text-xs mb-3" style={{ color: COLORS.wine }}>{erro}</p>}

          <div className="flex flex-col gap-2">
            {doCliente.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: COLORS.slate }}>Nenhum documento enviado ainda — contrato, procuração, documento pessoal etc.</p>
            )}
            {doCliente.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 rounded-md" style={{ border: `1px solid ${COLORS.line}` }}>
                <FileText size={16} color={COLORS.brass} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate" style={{ color: COLORS.ink }}>{d.nome_arquivo}</p>
                  <p className="text-xs" style={{ color: COLORS.slate }}>{formatTamanho(d.tamanho)} · {new Date(d.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
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
