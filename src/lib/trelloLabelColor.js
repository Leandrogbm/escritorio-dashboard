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
