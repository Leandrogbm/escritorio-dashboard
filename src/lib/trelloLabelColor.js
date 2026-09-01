// Cores de etiqueta do próprio Trello (paleta fixa da API) — mapeadas pro hex real pra bater
// visualmente com o que aparece lá. Usada no card fechado (TrelloQuadro) e no card aberto
// (TrelloCardModal).
const MAPA = {
  green: "#61BD4F", yellow: "#F2D600", orange: "#FF9F1A", red: "#EB5A46",
  purple: "#C377E0", blue: "#0079BF", sky: "#00C2E0", lime: "#51E898",
  pink: "#FF78CB", black: "#4D4D4D",
};

export function corLabel(nome) {
  return MAPA[nome] ?? "#B3BAC5";
}

// Texto branco fixo em cima de qualquer cor de etiqueta não tem contraste suficiente pra
// leitura (yellow/lime/sky ficam quase ilegíveis, achado real do frontend-designer) — decide
// entre texto escuro ou claro pela luminância real da cor de fundo, mesmo critério que o
// próprio Trello usa nas etiquetas dele.
export function corTextoLabel(nome) {
  const hex = corLabel(nome).replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const luminancia = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminancia > 0.6 ? "#172B4D" : "#fff";
}
