// Self-check: `node src/lib/pix.check.mjs`. Não é framework de teste — só um assert direto
// (ver convenção ponytail: lógica não-trivial, uma checagem, sem fixtures).
import { crc16, gerarPixCopiaCola } from "./pix.js";

function assert(cond, msg) {
  if (!cond) throw new Error("FALHOU: " + msg);
}

// Vetor de teste clássico do CRC16-CCITT-FALSE.
assert(crc16("123456789") === "29B1", "crc16('123456789') deveria ser 29B1");

const payload = gerarPixCopiaCola({
  chave: "11999998888",
  nome: "José Ção & Associados",
  cidade: "São Paulo",
  valor: 150.5,
  txid: "hon-123",
  descricao: "Honorário",
});

assert(payload.startsWith("000201"), "payload deveria começar com o indicador de formato");
assert(payload.includes("br.gov.bcb.pix"), "payload deveria conter o GUI do Pix");
assert(!/[ÇÃÕ]/.test(payload), "nome/cidade deveriam estar sem acento");
assert(payload.length > 8, "payload muito curto");

const semCrc = payload.slice(0, -4); // já inclui o "6304" do campo 63
const crcEmbutido = payload.slice(-4);
assert(crc16(semCrc) === crcEmbutido, "CRC do próprio payload deveria bater");

console.log("pix.js: OK");
