// Plano de contas simplificado de escritório de advocacia pro DRE (regime de caixa). Cada
// categoria de despesa (CATEGORIAS_DESPESA_COMUNS, texto livre) cai num grupo; o que não
// bate com nenhuma regra vai pra "Outras despesas". Receita é sempre honorário.
export const GRUPOS_DESPESA = [
  { key: "impostos", label: "Impostos e taxas", casa: /imposto|taxa|tributo|das\b|iss\b|simples/i },
  { key: "pessoal", label: "Despesas com pessoal", casa: /pessoal|sal[aá]rio|encargo|pr[oó]-labore|estagi|benef[ií]cio|vale/i },
  { key: "ocupacao", label: "Ocupação (aluguel, contas de consumo)", casa: /aluguel|condom[ií]nio|[aá]gua|luz|energia|internet|telefone|iptu/i },
  { key: "administrativas", label: "Despesas administrativas", casa: /software|assinatura|material|contador|contabil|manuten|equipamento|fornecedor|prestador|cart[oó]rio|custas/i },
  { key: "comerciais", label: "Despesas comerciais (marketing)", casa: /marketing|publicidade|an[uú]ncio|propaganda/i },
];
export const GRUPO_OUTRAS = { key: "outras", label: "Outras despesas" };

export function grupoDaDespesa(categoria) {
  return GRUPOS_DESPESA.find((g) => g.casa.test(categoria || "")) ?? GRUPO_OUTRAS;
}
