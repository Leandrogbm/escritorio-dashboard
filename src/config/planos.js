// Espelha a tabela plan_limits — só pra UX (rótulo, preço, limites mostrados na tela). O
// limite de verdade é aplicado no banco (RLS de processos_ins/clientes_ins, Edge Function
// admin-create-user); mudar aqui sem mudar lá só desalinha o texto.
// linkPagamento: link de cobrança do Mercado Pago (mpago.la), um por plano pago, valor fixo —
// usado só na cobrança lançada manualmente (EmpresaCobrancas/"Configurar"), não na assinatura
// via Payment Brick (essa não redireciona, tokeniza o cartão dentro do próprio Actum).
// 'gratis' é o trial por uso (signup-empresa sempre cria a org aqui, sem prazo de expiração,
// só limite de uso) — sem linkPagamento porque nunca é cobrado.
export const PLANOS = [
  { value: "gratis", label: "Grátis", valor: 0, limite_usuarios: 2, limite_processos: 2, limite_clientes: 2 },
  { value: "basic", label: "Básico", valor: 100, limite_usuarios: 5, limite_processos: 50, limite_clientes: 50, linkPagamento: "https://mpago.la/1zSfDNc" },
  { value: "intermediario", label: "Intermediário", valor: 300, limite_usuarios: 15, limite_processos: 200, limite_clientes: 200, linkPagamento: "https://mpago.la/2mUUt59" },
  { value: "plus", label: "Plus", valor: 500, limite_usuarios: null, limite_processos: null, limite_clientes: null, linkPagamento: "https://mpago.la/2xLoa9G" },
];

// Planos assináveis via Payment Brick (mercado-pago-criar-assinatura) — exclui 'gratis', que
// não é uma assinatura, é o estado inicial de toda org nova.
export const PLANOS_ASSINAVEIS = PLANOS.filter((p) => p.value !== "gratis");

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

export const DESCONTO_ANUAL = 0.05; // 5% sobre o valor mensal x12 (assinatura de cartão) — mesmo número usado em mercado-pago-criar-assinatura

// Valor de fato cobrado no ciclo escolhido — só pra exibir na UI (preço real é recalculado no
// banco pela Edge Function, nunca confia no que chega daqui). 'anual' já vem com o desconto.
export function valorCobranca(valorMensal, ciclo) {
  return ciclo === "anual" ? Math.round(valorMensal * 12 * (1 - DESCONTO_ANUAL) * 100) / 100 : Number(valorMensal);
}

// PIX pré-pago por período (mercado-pago-criar-pix) — trilho separado da assinatura de
// cartão: pagamento único, sem token salvo, "meses" pré-paga um período de acesso. Descontos
// maiores que o anual de cartão por período curto, iguais no de 12 meses (mesmo número, trilho
// diferente) — mesmos usados no servidor, nunca confiados do client.
export const DESCONTO_PIX = { 3: 0.03, 6: 0.04, 12: 0.05 };

export function valorPix(valorMensal, meses) {
  const desconto = DESCONTO_PIX[meses] ?? 0;
  return Math.round(valorMensal * meses * (1 - desconto) * 100) / 100;
}
