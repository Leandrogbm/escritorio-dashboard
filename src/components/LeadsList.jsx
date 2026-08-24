import React, { useState } from "react";
import { COLORS } from "../lib/theme.js";

const STATUS_OPTIONS = ["quente", "morno", "frio"];
const COR_STATUS = { quente: COLORS.wine, morno: COLORS.brass, frio: "#2563a3" };

// Tabela ordenável (status ou data) ao lado do mapa. `podeVerContato` decide se mostra a
// coluna de telefone — vem mascarado (null) na própria query pra quem não é admin/sócio
// (leads_captacao_view), aqui só decide se a coluna aparece ou não.
export default function LeadsList({ leads, onMudarStatus, podeVerContato }) {
  const [ordenarPor, setOrdenarPor] = useState("created_at");

  const ordenados = [...leads].sort((a, b) => {
    if (ordenarPor === "status") return STATUS_OPTIONS.indexOf(a.status) - STATUS_OPTIONS.indexOf(b.status);
    return b.created_at.localeCompare(a.created_at);
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: COLORS.ink }}>
            <th className="text-left px-3 py-2 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>NOME</th>
            {podeVerContato && <th className="text-left px-3 py-2 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>CONTATO</th>}
            <th className="text-left px-3 py-2 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>CIDADE</th>
            <th className="text-left px-3 py-2 font-semibold cursor-pointer" style={{ color: COLORS.paper, fontSize: 11 }} onClick={() => setOrdenarPor("status")}>STATUS {ordenarPor === "status" && "▾"}</th>
            <th className="text-left px-3 py-2 font-semibold cursor-pointer" style={{ color: COLORS.paper, fontSize: 11 }} onClick={() => setOrdenarPor("created_at")}>DATA {ordenarPor === "created_at" && "▾"}</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.length === 0 && (
            <tr><td colSpan={podeVerContato ? 5 : 4} className="px-3 py-6 text-center" style={{ color: COLORS.slate }}>Nenhum lead nessa área ainda.</td></tr>
          )}
          {ordenados.map((l, i) => (
            <tr key={l.id} style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
              <td className="px-3 py-2" style={{ color: COLORS.ink, fontWeight: 600 }}>{l.nome}</td>
              {podeVerContato && <td className="px-3 py-2" style={{ color: COLORS.slate }}>{l.contato ?? "—"}</td>}
              <td className="px-3 py-2" style={{ color: COLORS.slate }}>{l.cidade || "—"}</td>
              <td className="px-3 py-2">
                <select
                  value={l.status}
                  onChange={(e) => onMudarStatus(l.id, e.target.value)}
                  className="px-2 py-1 rounded text-xs font-semibold capitalize"
                  style={{ border: `1px solid ${COR_STATUS[l.status]}`, color: COR_STATUS[l.status], background: "transparent" }}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td className="px-3 py-2" style={{ color: COLORS.slate }}>{new Date(l.created_at).toLocaleDateString("pt-BR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
