import { useEffect } from "react";

// Fecha qualquer popup (modal, painel lateral, dropdown) ao apertar Esc. `ativo` deixa opcional
// pra componentes que só existem quando já estão abertos e outros que ficam sempre montados
// (ex.: dropdown de sino) e precisam do listener só enquanto abertos.
export function useEscClose(onClose, ativo = true) {
  useEffect(() => {
    if (!ativo) return;
    const ouvir = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", ouvir);
    return () => window.removeEventListener("keydown", ouvir);
  }, [onClose, ativo]);
}
