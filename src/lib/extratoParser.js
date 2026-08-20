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

// Extrato em PDF (o app do banco geralmente só oferece isso, mesmo quando o internet
// banking no navegador tem OFX/CSV) — extrai o texto por linha (agrupando itens pela
// posição Y) e procura "data ... um único valor em R$" por linha. Só aceita linha com
// exatamente 1 valor monetário: statements costumam ter colunas "valor" E "saldo", as duas
// no formato de dinheiro — se aparecem 2+ valores na linha não dá pra saber qual é qual
// com segurança, então a linha é ignorada (fica de fora, não vira match errado).
const DATA_RE = /(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/;
const VALOR_RE = /R?\$?\s?-?\d{1,3}(?:\.\d{3})*,\d{2}/g;

async function parsePdf(file) {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const linhasTexto = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const porY = new Map();
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (!porY.has(y)) porY.set(y, []);
      porY.get(y).push(item);
    }
    for (const itens of porY.values()) {
      linhasTexto.push(itens.sort((a, b) => a.transform[4] - b.transform[4]).map((i) => i.str).join(" "));
    }
  }

  const out = [];
  for (const linha of linhasTexto) {
    const dataMatch = linha.match(DATA_RE);
    const valores = linha.match(VALOR_RE);
    if (!dataMatch || !valores || valores.length !== 1) continue;
    const data = normalizarData(dataMatch[1]);
    const valor = normalizarValor(valores[0]);
    if (data && valor != null) out.push({ data, valor, memo: linha.replace(DATA_RE, "").replace(VALOR_RE, "").trim() });
  }
  return out;
}

// Só entradas (créditos) interessam pra achar pagamento recebido — TRNAMT/valor negativo é saída.
export async function parseExtrato(file) {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    return (await parsePdf(file)).filter((l) => l.valor > 0);
  }
  const texto = await file.text();
  const linhas = /<OFX>|<STMTTRN>/i.test(texto) ? parseOfx(texto) : parseCsv(texto);
  return linhas.filter((l) => l.valor > 0);
}
