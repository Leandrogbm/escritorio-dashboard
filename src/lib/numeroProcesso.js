// Máscara CNJ "NNNNNNN-DD.AAAA.J.TR.OOOO" (20 dígitos: 7-2.4.1.2.4) — formata
// progressivamente enquanto digita, mesmo padrão de formatCelular/formatDocumento. Digitar
// só os números já preenche os pontos e traços sozinho; colar um número já formatado
// também funciona (os \D são removidos antes de remontar).
export function formatNumeroProcesso(raw) {
  const d = (raw || "").replace(/\D/g, "").slice(0, 20);
  if (!d) return "";
  if (d.length <= 7) return d;
  if (d.length <= 9) return `${d.slice(0, 7)}-${d.slice(7)}`;
  if (d.length <= 13) return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9)}`;
  if (d.length <= 14) return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13)}`;
  if (d.length <= 16) return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14)}`;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}
