import React, { useEffect, useState } from "react";
import { X, Loader2, Search } from "lucide-react";
import Card from "./Card.jsx";
import { COLORS } from "../lib/theme.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { useEscClose } from "../hooks/useEscClose.js";
import { supabase } from "../lib/supabaseClient.js";
import { formatNumeroProcesso } from "../lib/numeroProcesso.js";

// Busca processos do cliente na Escavador (Configurações → Integrações) e mostra pra
// revisão — nada entra em Processos sem o usuário marcar e confirmar (resultado de busca
// externa pode vir errado: nome parecido, processo já encerrado há anos etc.).
export default function EscavadorBuscaModal({ cliente, orgId, onClose }) {
  useEscClose(onClose, true);
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { insert: insertProcesso } = useSupabaseTable("processos", { eq: orgEq });

  const [resultados, setResultados] = useState(null); // null = carregando
  const [erro, setErro] = useState("");
  const [marcados, setMarcados] = useState(new Set());
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke("escavador-buscar-processos", { body: { clienteId: cliente.id } });
      if (cancelado) return;
      if (error) {
        setErro((await error.context?.json?.().catch(() => null))?.error ?? error.message);
        return;
      }
      setResultados(data.resultados ?? []);
    })();
    return () => { cancelado = true; };
  }, [cliente.id]);

  const alternar = (numero) => setMarcados((s) => {
    const novo = new Set(s);
    novo.has(numero) ? novo.delete(numero) : novo.add(numero);
    return novo;
  });

  const adicionar = async () => {
    setSalvando(true);
    const escolhidos = (resultados ?? []).filter((r) => marcados.has(r.numeroProcesso));
    // normaliza pro formato CNJ com pontos/traços mesmo se a Escavador devolver só dígitos
    // (numeroCnjValido/extrairTribunalAlias no datajud-sync já ignoram pontuação, então
    // reformatar aqui não afeta a sincronização, só padroniza a exibição).
    await insertProcesso(escolhidos.map((r) => ({
      numero: formatNumeroProcesso(r.numeroProcesso),
      cliente_id: cliente.id,
      area: r.assunto || "A classificar",
      status: "Em andamento",
    })));
    setSalvando(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card style={{ boxShadow: "0 20px 48px rgba(22,35,59,0.22)" }}>
          <div className="flex items-center justify-between mb-1">
            <p className="flex items-center gap-1.5" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 16, color: COLORS.ink }}>
              <Search size={16} color={COLORS.brass} /> Processos na Escavador
            </p>
            <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
          </div>
          <p className="text-xs mb-4" style={{ color: COLORS.slate }}>{cliente.nome}</p>

          {erro && <p className="text-xs" style={{ color: COLORS.wine }}>{erro}</p>}
          {!erro && !resultados && (
            <p className="flex items-center gap-2 text-xs" style={{ color: COLORS.slate }}><Loader2 size={13} className="animate-spin" /> Buscando...</p>
          )}
          {resultados && resultados.length === 0 && (
            <p className="text-xs" style={{ color: COLORS.slate }}>Nenhum processo encontrado pra esse CPF/CNPJ.</p>
          )}
          {resultados && resultados.length > 0 && (
            <>
              <p className="text-xs mb-2" style={{ color: COLORS.slate }}>Marque os que são desse cliente de verdade — só esses entram em Processos.</p>
              <div className="flex flex-col gap-2 mb-4">
                {resultados.map((r) => (
                  <label key={r.numeroProcesso} className="flex items-start gap-2 px-3 py-2 rounded-md text-xs cursor-pointer" style={{ border: `1px solid ${COLORS.line}` }}>
                    <input type="checkbox" checked={marcados.has(r.numeroProcesso)} onChange={() => alternar(r.numeroProcesso)} className="mt-0.5" />
                    <span>
                      <span className="block font-semibold" style={{ color: COLORS.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{r.numeroProcesso}</span>
                      <span className="block" style={{ color: COLORS.slate }}>{[r.tribunal, r.classe, r.assunto].filter(Boolean).join(" · ")}</span>
                    </span>
                  </label>
                ))}
              </div>
              <button onClick={adicionar} disabled={marcados.size === 0 || salvando} className="px-3.5 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: marcados.size === 0 || salvando ? 0.5 : 1 }}>
                {salvando ? "Adicionando..." : `Adicionar ${marcados.size || ""} processo(s)`}
              </button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
