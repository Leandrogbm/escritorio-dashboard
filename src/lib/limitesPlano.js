import { planoPorValue, planoLabelCompleto, proximoPlano } from "../config/planos.js";

// Retorna null se pode criar, ou a mensagem de aviso (com oferta de upgrade pro próximo
// plano) se o limite do plano atual já foi atingido. `contagemAtual` já deve vir filtrada
// (ex.: só processo ativo, não Encerrado) — quem chama decide o que conta.
export function avisoLimitePlano(organizations, campoLimite, contagemAtual, recurso) {
  const plano = planoPorValue(organizations?.plano);
  const limite = plano?.[campoLimite];
  if (limite == null || contagemAtual < limite) return null;
  const prox = proximoPlano(plano.value);
  return prox
    ? `Limite de ${limite} ${recurso} do plano ${plano.label} atingido. Faça upgrade para o plano ${planoLabelCompleto(prox)} pra continuar cadastrando (fale com o suporte da plataforma).`
    : `Limite de ${limite} ${recurso} do plano ${plano.label} atingido. Fale com o suporte da plataforma.`;
}
