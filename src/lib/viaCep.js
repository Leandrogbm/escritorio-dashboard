// ViaCEP: API pública gratuita do governo/comunidade, sem chave — busca direto do browser.
// Só devolve o que ela sabe; número e complemento continuam manuais (o CEP não sabe disso).
export async function buscarEnderecoPorCep(cepDigitado) {
  const cep = (cepDigitado || "").replace(/\D/g, "");
  if (cep.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return { logradouro: data.logradouro, bairro: data.bairro, cidade: data.localidade, uf: data.uf };
  } catch {
    return null; // sem internet ou ViaCEP fora do ar — usuário preenche na mão, sem travar o form
  }
}
