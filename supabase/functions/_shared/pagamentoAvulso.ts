// Desconto de pagamento único pré-pago por período (3/6/12 meses) — um lugar só calculando,
// os dois trilhos (mercado-pago-criar-pix e mercado-pago-criar-pagamento-cartao) importam
// daqui em vez de duplicar a tabela/conta. Mesmos números que src/config/planos.js usa só
// pra exibir (DESCONTO_PIX lá) — preço de verdade sempre sai daqui, nunca do client.
export const DESCONTO_PAGAMENTO_AVULSO: Record<number, number> = { 3: 0.03, 6: 0.04, 12: 0.05 };

export function mesesValidos(meses: unknown): meses is 3 | 6 | 12 {
  return meses === 3 || meses === 6 || meses === 12;
}

export function valorPagamentoAvulso(valorMensal: number, meses: number) {
  const desconto = DESCONTO_PAGAMENTO_AVULSO[meses] ?? 0;
  return Math.round(valorMensal * meses * (1 - desconto) * 100) / 100;
}

// "acesso pago até tal data, sem renovação automática" — mesmo conceito pros dois trilhos
// (PIX e cartão pré-pago), guardado em organizations.acesso_pago_ate.
export function acessoPagoAteISO(meses: number) {
  const data = new Date();
  data.setMonth(data.getMonth() + meses);
  return data.toISOString();
}
