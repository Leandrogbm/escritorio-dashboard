import React, { useState } from "react";
import { ArrowLeft, Upload, FileText, Trash2, Download } from "lucide-react";
import Card from "./Card.jsx";
import { COLORS } from "../lib/theme.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { supabase } from "../lib/supabaseClient.js";

const BUCKET = "documentos-cliente";

// Extensões aceitas (o navegador já filtra pelo "accept" do input, isso aqui é a segunda
// trava — cola de link ou navegador ignorando o accept não passa batido).
const ACCEPT = ".csv,.pdf,.doc,.docx,.xls,.xlsx";
const EXTENSOES_VALIDAS = [".csv", ".pdf", ".doc", ".docx", ".xls", ".xlsx"];
function extensaoValida(nome) {
  return EXTENSOES_VALIDAS.some((ext) => nome.toLowerCase().endsWith(ext));
}

function formatTamanho(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Página cheia (mesmo padrão do ProcessoPagina — não é popup) com os documentos do cliente
// (contrato de honorários já assinado, procuração, RG/CNPJ etc.). Bucket privado — link de
// download é assinado (expira).
export default function ClienteDocumentosPagina({ cliente, orgId, profile, onVoltar }) {
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
    if (!extensaoValida(file.name)) {
      setErro("Formato não aceito — envie CSV, PDF, Word (.doc/.docx) ou Excel (.xls/.xlsx).");
      return;
    }
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
    <div>
      <button onClick={onVoltar} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: COLORS.slate }}>
        <ArrowLeft size={15} /> Voltar pra Clientes
      </button>

      <div className="mb-5">
        <p className="text-2xl" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.ink }}>{cliente.nome}</p>
        <p className="text-sm" style={{ color: COLORS.slate }}>Documentos do cliente</p>
      </div>

      <Card>
        <label className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm cursor-pointer w-fit" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
          <Upload size={14} /> {enviando ? "Enviando..." : "Enviar documento"}
          <input type="file" accept={ACCEPT} className="hidden" disabled={enviando} onChange={enviarArquivo} />
        </label>
        <p className="text-xs mt-1.5 mb-4" style={{ color: COLORS.slate }}>CSV, PDF, Word ou Excel</p>
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
  );
}
