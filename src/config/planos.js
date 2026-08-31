// Espelha a tabela plan_limits — só pra UX (rótulo, preço, limites mostrados na tela). O
// limite de verdade é aplicado no banco (RLS de processos_ins/clientes_ins, Edge Function
// admin-create-user); mudar aqui sem mudar lá só desalinha o texto.
export const PLANOS = [
  { value: "basic", label: "Basic", valor: 100, limite_usuarios: 5, limite_processos: 50, limite_clientes: 50 },
  { value: "intermediario", label: "Intermediário", valor: 300, limite_usuarios: 15, limite_processos: 200, limite_clientes: 200 },
  { value: "plus", label: "Plus", valor: 500, limite_usuarios: null, limite_processos: null, limite_clientes: null },
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
