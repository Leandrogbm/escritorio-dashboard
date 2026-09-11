// Direção "capa de processo": em vez de navy corporativo ou cinza neutro (as duas tentativas
// anteriores, rejeitadas por parecerem "SaaS genérico"), a cor de base vem do verde-cartório —
// o verde escuro de capa de processo/livro de registro e tinta de carimbo notarial brasileiro.
// É tão "documento jurídico" quanto o serifado do título, só que ninguém mais usa (todo SaaS
// clonado vai de azul ou cinza) — por isso lê como escolha, não como default.
export const COLORS = {
  ink: "#1B3328",
  inkSoft: "#33503F",
  paper: "#F2F0E9",
  paperRaised: "#FBF9F3",
  wine: "#9B2226",
  brass: "#A5793B",
  // Mesmo tom, mais escuro — só pra texto/link em cima de fundo claro (paper/branco).
  // brass puro fica em ~3.4-3.9:1 de contraste aí, abaixo do mínimo de 4.5:1 do WCAG AA
  // pra texto pequeno. Em ícone, fundo escuro (sidebar) ou número grande (2xl+), brass
  // normal já passa (regra de "large text"/non-text é 3:1) — troca só onde é texto miúdo.
  brassText: "#84612F",
  slate: "#5C6B60",
  success: "#1E8449",
  line: "#DCD7C9",
};
