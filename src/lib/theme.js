export const COLORS = {
  ink: "#16233B",
  inkSoft: "#2C3B57",
  paper: "#F2F0E9",
  paperRaised: "#FFFFFF",
  wine: "#C1272D",
  brass: "#A5793B",
  // Mesmo tom, mais escuro — só pra texto/link em cima de fundo claro (paper/branco).
  // brass puro fica em ~3.4-3.9:1 de contraste aí, abaixo do mínimo de 4.5:1 do WCAG AA
  // pra texto pequeno. Em ícone, fundo escuro (sidebar) ou número grande (2xl+), brass
  // normal já passa (regra de "large text"/non-text é 3:1) — troca só onde é texto miúdo.
  brassText: "#84612F",
  slate: "#5B6472",
  success: "#1E8449",
  line: "#DCD7C9",
};
