// Gera o Pix "copia e cola" (BR Code EMV estático, BACEN) pro corpo do e-mail de cobrança.
// Mesmo algoritmo do gerador client-side (src/lib/pix.js, outro agente) — reimplementado aqui
// porque Edge Function roda em Deno, não importa código do bundle do frontend. Byte-idêntico
// a pix.js pros mesmos inputs (normalização, truncamento, fallback de nome/cidade, descrição
// opcional no campo 02) — qualquer mudança lá precisa ser espelhada aqui.
// Referência: manual "BR Code" do BACEN (payload EMV, campos 00/26/52/53/54/58/59/60/62/63).

function campo(id: string, valor: string): string {
  return `${id}${String(valor.length).padStart(2, "0")}${valor}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// Remove acento e caractere fora de A-Z0-9/espaço, maiúsculo, corta no limite — nome e
// cidade do recebedor no payload Pix só aceitam ASCII simples.
function normalizar(s: string | undefined | null, max: number): string {
  const semAcento = (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "");
  return semAcento.trim().slice(0, max);
}

export function gerarPixCopiaECola(opts: {
  chave: string;
  nomeRecebedor: string;
  cidade: string;
  valor?: number; // opcional: sem valor, quem paga digita na hora
  txid?: string; // até 25 alfanumérico, "***" se não houver controle de conciliação
  descricao?: string; // opcional, campo 02 do merchant account info
}): string {
  if (!opts.chave || !opts.chave.trim()) throw new Error("Chave Pix não configurada.");
  const nome = normalizar(opts.nomeRecebedor, 25) || "RECEBEDOR";
  const cidade = normalizar(opts.cidade, 15) || "BRASIL";
  const txid = (opts.txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  const merchantAccountInfo =
    campo("00", "br.gov.bcb.pix") +
    campo("01", opts.chave.trim()) +
    (opts.descricao ? campo("02", opts.descricao.slice(0, 72)) : "");

  const partes = [
    campo("00", "01"), // payload format indicator
    campo("26", merchantAccountInfo),
    campo("52", "0000"), // MCC genérico
    campo("53", "986"), // BRL
    ...(opts.valor && opts.valor > 0 ? [campo("54", Number(opts.valor).toFixed(2))] : []),
    campo("58", "BR"),
    campo("59", nome),
    campo("60", cidade),
    campo("62", campo("05", txid)),
  ];

  const semCrc = partes.join("") + "6304";
  return semCrc + crc16(semCrc);
}
