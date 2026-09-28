// Pix "copia e cola" estático (BR Code, spec BACEN EMV) — sem plataforma de pagamento
// nenhuma no meio, o próprio escritório cadastra a chave (ver MinhaEmpresaTab). Confirmação
// de pagamento continua manual/via Importar extrato: Pix estático não tem webhook.

// CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF) — algoritmo exigido pelo campo 63 do payload.
export function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// TLV: id (2 dígitos) + tamanho (2 dígitos) + valor.
const tlv = (id, valor) => `${id}${String(valor.length).padStart(2, "0")}${valor}`;

// Remove acento e caractere fora de A-Z0-9/espaço, maiúsculo, corta no limite — nome e
// cidade do recebedor no payload Pix só aceitam ASCII simples.
function normalizar(s, max) {
  const semAcento = (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "");
  return semAcento.trim().slice(0, max);
}

// Monta o payload EMV do Pix estático (copia-e-cola) pra um valor fixo.
export function gerarPixCopiaCola({ chave, nome, cidade, valor, txid, descricao }) {
  if (!chave || !chave.trim()) throw new Error("Chave Pix não configurada.");
  const nomeOk = normalizar(nome, 25) || "RECEBEDOR";
  const cidadeOk = normalizar(cidade, 15) || "BRASIL";
  const txidOk = (txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  const merchantAccountInfo =
    tlv("00", "br.gov.bcb.pix") +
    tlv("01", chave.trim()) +
    (descricao ? tlv("02", descricao.slice(0, 72)) : "");

  const partes = [
    tlv("00", "01"), // payload format indicator
    tlv("26", merchantAccountInfo),
    tlv("52", "0000"), // MCC genérico
    tlv("53", "986"), // BRL
    ...(valor > 0 ? [tlv("54", Number(valor).toFixed(2))] : []),
    tlv("58", "BR"),
    tlv("59", nomeOk),
    tlv("60", cidadeOk),
    tlv("62", tlv("05", txidOk)),
  ];

  const semCrc = partes.join("") + "6304";
  return semCrc + crc16(semCrc);
}
