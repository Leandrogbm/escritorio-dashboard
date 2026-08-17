// Extrai o alias da API DataJud (ex.: "tjsp") a partir do número CNJ do processo.
//
// Formato do número (Resolução CNJ 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO (20 dígitos).
//   J  = segmento de justiça (1 dígito)
//   TR = tribunal dentro do segmento (2 dígitos)
//
// Tabela de códigos: dígito J confirmado no próprio texto da Resolução 65 (art. 1º, §4º/5º).
// Código TR de TJ (J=8) e TRE (J=6) confirmado via busca — ambos seguem ordem alfabética dos
// estados 01-27 (fonte: cnj.jus.br, cruzado com o fato conhecido de TJSP = 8.26). TRF (J=4) e
// TRT (J=5) mapeiam direto pro número da região (TR=01 → região 1, etc.), sem tabela — isso
// já é como os próprios tribunais se numeram. Se um alias vier errado aqui, o /_search da
// DataJud retorna 404 e o processo fica marcado 'nao_suportado' em vez de quebrar o sync
// inteiro — dá pra corrigir esse mapa depois sem re-rodar nada manualmente.

// TJ e TRE (mesma ordem alfabética de estado, códigos 01-27)
const ORDEM_ESTADOS = [
  "ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms", "mg",
  "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "se", "sp", "to",
];

function aliasTJ(tr: number): string | null {
  const estado = ORDEM_ESTADOS[tr - 1];
  if (!estado) return null;
  return estado === "df" ? "tjdft" : `tj${estado}`;
}

function aliasTRE(tr: number): string | null {
  const estado = ORDEM_ESTADOS[tr - 1];
  return estado ? `tre-${estado}` : null;
}

export function extrairTribunalAlias(numeroCru: string): string | null {
  const digitos = (numeroCru || "").replace(/\D/g, "");
  if (digitos.length !== 20) return null;
  // NNNNNNN(7) DD(2) AAAA(4) J(1) TR(2) OOOO(4)
  const j = Number(digitos.slice(13, 14));
  const tr = Number(digitos.slice(14, 16));

  switch (j) {
    case 3: return "stj"; // TR sempre 00 nesse segmento
    case 4: return tr >= 1 && tr <= 6 ? `trf${tr}` : null;
    case 5: return tr >= 1 && tr <= 24 ? `trt${tr}` : null;
    case 6: return aliasTRE(tr);
    case 7: return "stm";
    case 8: return aliasTJ(tr);
    default: return null; // J=1 (STF), 2 (CNJ), 9 (militar estadual) — fora de escopo por ora
  }
}

// Dígito verificador (módulo 97 base 10) — valida o formato antes de gastar uma chamada
// de API com um número digitado errado. BigInt porque 18 dígitos estoura Number com segurança.
export function numeroCnjValido(numeroCru: string): boolean {
  const digitos = (numeroCru || "").replace(/\D/g, "");
  if (digitos.length !== 20) return false;
  const corpo = digitos.slice(0, 7) + digitos.slice(9); // remove os 2 dígitos verificadores (posições 7-8)
  const dv = digitos.slice(7, 9);
  const resto = BigInt(corpo + "00") % 97n;
  const dvCalculado = 98n - resto;
  return dvCalculado.toString().padStart(2, "0") === dv;
}
