// Espelha a tabela plan_limits — só pra UX (rótulo, preço, limites mostrados na tela). O
// limite de verdade é aplicado no banco (RLS de processos_ins/clientes_ins, Edge Function
// admin-create-user); mudar aqui sem mudar lá só desalinha o texto.
// linkPagamento: link de cobrança do Mercado Pago (mpago.la), um por plano, valor fixo —
// não é checkout dinâmico, é o mesmo link fixo sempre que alguém precisa pagar aquele plano.
export const PLANOS = [
  { value: "basic", label: "Básico", valor: 100, limite_usuarios: 5, limite_processos: 50, limite_clientes: 50, linkPagamento: "https://mpago.la/1zSfDNc" },
  { value: "intermediario", label: "Intermediário", valor: 300, limite_usuarios: 15, limite_processos: 200, limite_clientes: 200, linkPagamento: "https://mpago.la/2mUUt59" },
  { value: "plus", label: "Plus", valor: 500, limite_usuarios: null, limite_processos: null, limite_clientes: null, linkPagamento: "https://mpago.la/2xLoa9G" },
];

export function planoLabelCompleto(p) {
  const limites = p.limite_usuarios == null
    ? "ilimitado"
    : `${p.limite_usuarios} usuários, ${p.limite_processos} processos ativos, ${p.limite_clientes} clientes`;
  return `${p.label} — R$${p.valor}/mês (${limites})`;
}

export function proximoPlano(planoAtual) {
  const i = PLANOS.findIndex((p) => p.value === planoAtual);
  return i >= 0 && i < PLANOS.length - 1 ? PLANOS[i + 1] : null;
}

export function planoPorValue(value) {
  return PLANOS.find((p) => p.value === value) ?? null;
}

// Cobrança lançada (platform_cobrancas) guarda só o valor, não a chave do plano — acha o
// plano de volta pelo preço pra saber qual link de pagamento mostrar.
export function planoPorValor(valor) {
  return PLANOS.find((p) => Number(p.valor) === Number(valor)) ?? null;
}
