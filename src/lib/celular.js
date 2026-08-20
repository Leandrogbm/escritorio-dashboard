// Máscara "(DD) DDDDD-DDDD" (celular, 11 dígitos) ou "(DD) DDDD-DDDD" (fixo, 10 dígitos) —
// formata progressivamente enquanto digita, sem depender de lib externa.
export function formatCelular(raw) {
  const d = (raw || "").replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
