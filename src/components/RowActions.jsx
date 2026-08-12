import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { COLORS } from "../lib/theme.js";

// Botões de editar/excluir reaproveitados nas linhas de tabela com CRUD.
export default function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      <button onClick={onEdit} aria-label="Editar" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.slate }}>
        <Pencil size={14} />
      </button>
      <button
        onClick={() => { if (confirm("Excluir este registro?")) onDelete(); }}
        aria-label="Excluir"
        className="p-1.5 rounded hover:opacity-70"
        style={{ color: COLORS.wine }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
