// Confirmação "digite pra confirmar" — usada em toda exclusão de peso real (processo,
// cliente, colaborador...), onde um confirm() genérico é fácil demais de clicar sem pensar.
export function confirmarExclusao(campo, valor, acao) {
  const digitado = prompt(`Pra confirmar, digite ${campo} exato:\n\n"${valor}"`);
  if (digitado === null) return;
  if (digitado.trim() !== String(valor).trim()) { alert("Não confere — nada foi excluído."); return; }
  acao();
}
