// BrasilAPI: espelho público e gratuito dos dados da Receita Federal, sem chave — busca
// direto do browser (CORS liberado, feito pra isso). Só preenche o que ela sabe; número/
// complemento e o que não veio continuam manuais.
export async function buscarEmpresaPorCnpj(documentoDigitado) {
  const cnpj = (documentoDigitado || "").replace(/\D/g, "");
  if (cnpj.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!res.ok) return null; // CNPJ inexistente ou inválido
    const data = await res.json();
    return {
      tipo: "PJ",
      nome: data.razao_social || data.nome_fantasia || undefined,
      cep: data.cep || undefined,
      logradouro: data.logradouro || undefined,
      numero: data.numero || undefined,
      bairro: data.bairro || undefined,
      cidade: data.municipio || undefined,
      uf: data.uf || undefined,
      email: data.email || undefined,
      celular: data.ddd_telefone_1 || undefined,
    };
  } catch {
    return null; // sem internet ou BrasilAPI fora do ar — usuário preenche na mão, sem travar o form
  }
}
