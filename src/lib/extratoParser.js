// Lê extrato bancário (OFX, que praticamente todo banco BR exporta, ou CSV simples
// "data;valor;descrição") e devolve só os créditos (entradas), pra casar com cobranças
// pendentes. Sem lib externa — OFX 1.x é SGML com tags sem fechamento, então regex
// "<TAG>valor até a próxima tag ou quebra de linha" cobre tanto OFX 1.x quanto 2.x (XML).

function normalizarData(raw) {
  if (!raw) return null;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{8}/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`; // OFX DTPOSTED
  return null;
}

function normalizarValor(raw) {
  if (raw == null) return null;
  const limpo = String(raw).replace(/^R\$\s?/i, "").trim();
  // "1.234,56" (BR) vs "1234.56" (US) — vírgula como último separador decide o formato
  const n = limpo.includes(",")
    ? Number(limpo.replace(/\./g, "").replace(",", "."))
    : Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function parseOfx(texto) {
  const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const out = [];
  for (const bloco of blocos) {
    const pega = (tag) => bloco.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i"))?.[1]?.trim();
    const data = normalizarData(pega("DTPOSTED"));
    const valor = normalizarValor(pega("TRNAMT"));
    const memo = pega("MEMO") || pega("NAME") || "";
    if (data && valor != null) out.push({ data, valor, memo });
  }
  return out;
}

function parseCsv(texto) {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!linhas.length) return [];
  const delim = linhas[0].includes(";") ? ";" : ",";
  let rows = linhas.map((l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, "")));
  const pareceData = (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!pareceData(rows[0]?.[0])) rows = rows.slice(1); // primeira linha sem data = cabeçalho
  const out = [];
  for (const [dataRaw, valorRaw, ...resto] of rows) {
    const data = normalizarData(dataRaw);
    const valor = normalizarValor(valorRaw);
    if (data && valor != null) out.push({ data, valor, memo: resto.join(" ") });
  }
  return out;
}

// Só entradas (créditos) interessam pra achar pagamento recebido — TRNAMT negativo é saída.
export async function parseExtrato(file) {
  const texto = await file.text();
  const linhas = /<OFX>|<STMTTRN>/i.test(texto) ? parseOfx(texto) : parseCsv(texto);
  return linhas.filter((l) => l.valor > 0);
}
