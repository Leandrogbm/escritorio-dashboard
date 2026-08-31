import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { confirmarExclusao } from "../lib/confirmarExclusao.js";

// Botões de editar/excluir reaproveitados nas linhas de tabela com CRUD.
// `confirmLabel` (opcional): quando um registro tem peso real (processo, cliente — dado que
// arrasta outras tabelas junto), pede pra digitar esse valor exato em vez de só "tem certeza?"
// — mesmo padrão que "excluirEmpresa" já usava no painel da plataforma. Sem isso, cai no
// confirm() simples de sempre (prazo avulso, tarefa etc. não precisam do peso extra).
export default function RowActions({ onEdit, onDelete, confirmLabel, confirmCampo = "o valor" }) {
  const excluir = () => {
    if (confirmLabel == null) {
      if (confirm("Excluir este registro?")) onDelete();
      return;
    }
    confirmarExclusao(confirmCampo, confirmLabel, onDelete);
  };

  return (
    <div className="flex items-center gap-2 justify-end">
      <button onClick={onEdit} aria-label="Editar" className="p-1.5 rounded hover:opacity-70" style={{ color: COLORS.slate }}>
        <Pencil size={14} />
      </button>
      {onDelete && (
        <button
          onClick={excluir}
          aria-label="Excluir"
          className="p-1.5 rounded hover:opacity-70"
          style={{ color: COLORS.wine }}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
