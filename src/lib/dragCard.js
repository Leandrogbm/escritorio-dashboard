// Física do gesto de arrastar um card (Quadro de tarefas + Trello embutido): leve
// inclinação + elevação durante o arraste, soltando suave. Ambos os quadros já usam
// drag-and-drop HTML5 nativo (draggable/onDragStart/onDrop) — isso só monta uma imagem de
// arraste rotacionada via dataTransfer.setDragImage (a imagem nativa do navegador não herda
// CSS aplicado depois do dragstart) e devolve o estilo pro card de origem enquanto arrasta.
export function iniciarArrastoComInclinacao(e) {
  const original = e.currentTarget;
  const rect = original.getBoundingClientRect();
  const clone = original.cloneNode(true);
  clone.style.position = "fixed";
  clone.style.top = "-9999px";
  clone.style.left = "-9999px";
  clone.style.width = `${rect.width}px`;
  clone.style.transform = "rotate(-4deg) scale(1.03)";
  clone.style.boxShadow = "0 20px 40px rgba(0,0,0,0.35)";
  clone.style.pointerEvents = "none";
  document.body.appendChild(clone);
  e.dataTransfer.setDragImage(clone, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  setTimeout(() => document.body.removeChild(clone), 0);
}

// Estilo do card de origem (o que fica pra trás na coluna) enquanto o id dele está sendo
// arrastado — some suave (transition) quando o arraste termina/solta.
export const estiloArrastando = (arrastando) => ({
  transition: "opacity 150ms ease, transform 150ms ease",
  opacity: arrastando ? 0.4 : 1,
  transform: arrastando ? "scale(0.97)" : "scale(1)",
});
