// Download de UMA parte (anexo) direto pelo protocolo IMAP sobre Deno.connectTls — sem imapflow.
// Motivo: imapflow trava baixando parte >~1MB dentro do edge-runtime do Supabase
// (postalsys/imapflow#401), e anexo de escritório passa disso toda hora (PDF de processo).
// Faz só o mínimo: LOGIN, EXAMINE (somente leitura — não marca como lido), UID FETCH da parte
// + cabeçalho MIME dela, LOGOUT.

const enc = new TextEncoder();

class Leitor {
  private buf = new Uint8Array(0);
  constructor(private conn: Deno.TlsConn) {}

  private async encher() {
    const chunk = new Uint8Array(64 * 1024);
    const n = await this.conn.read(chunk);
    if (n === null) throw new Error("Conexão IMAP encerrada pelo servidor.");
    const novo = new Uint8Array(this.buf.length + n);
    novo.set(this.buf);
    novo.set(chunk.subarray(0, n), this.buf.length);
    this.buf = novo;
  }

  async linha(): Promise<string> {
    for (;;) {
      for (let i = 0; i + 1 < this.buf.length; i++) {
        if (this.buf[i] === 13 && this.buf[i + 1] === 10) {
          const l = new TextDecoder().decode(this.buf.subarray(0, i));
          this.buf = this.buf.subarray(i + 2);
          return l;
        }
      }
      await this.encher();
    }
  }

  // Literal grande lido direto no buffer final (sem realocar a cada pedaço).
  async bytes(n: number): Promise<Uint8Array> {
    const out = new Uint8Array(n);
    const doBuf = Math.min(n, this.buf.length);
    out.set(this.buf.subarray(0, doBuf));
    this.buf = this.buf.subarray(doBuf);
    let off = doBuf;
    while (off < n) {
      const r = await this.conn.read(out.subarray(off));
      if (r === null) throw new Error("Conexão IMAP encerrada no meio do download.");
      off += r;
    }
    return out;
  }
}

function quote(s: string) {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// Nome de pasta com acento vai em "UTF-7 modificado" (RFC 3501 §5.1.3).
function mutf7(s: string) {
  return s.replace(/&/g, "&-").replace(/[^\x20-\x7e]+/g, (trecho) => {
    let bin = "";
    for (let i = 0; i < trecho.length; i++) {
      const u = trecho.charCodeAt(i);
      bin += String.fromCharCode(u >> 8, u & 255);
    }
    return "&" + btoa(bin).replace(/=+$/, "").replace(/\//g, ",") + "-";
  });
}

type Literal = { cabecalho: string; dados: Uint8Array };

async function comando(conn: Deno.TlsConn, leitor: Leitor, tag: string, cmd: string, limiteLiteral: number): Promise<Literal[]> {
  await conn.write(enc.encode(`${tag} ${cmd}\r\n`));
  const literais: Literal[] = [];
  for (;;) {
    const l = await leitor.linha();
    const m = l.match(/\{(\d+)\}$/);
    if (m) {
      const n = Number(m[1]);
      if (n > limiteLiteral) throw new Error("Anexo maior que 15 MB.");
      literais.push({ cabecalho: l, dados: await leitor.bytes(n) });
      continue;
    }
    if (l.startsWith(`${tag} `)) {
      if (!/^\S+ OK/i.test(l)) {
        // "login" no texto faz o erroAmigavel mapear pra "e-mail ou senha incorretos".
        throw new Error(cmd.startsWith("LOGIN") ? `login recusado: ${l}` : l);
      }
      return literais;
    }
  }
}

function decodificarQP(bytes: Uint8Array) {
  const out: number[] = [];
  const hex = (b: number) => (b >= 48 && b <= 57) || (b >= 65 && b <= 70) || (b >= 97 && b <= 102);
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 61) { // "="
      if (bytes[i + 1] === 13 && bytes[i + 2] === 10) { i += 2; continue; }
      if (bytes[i + 1] === 10) { i += 1; continue; }
      if (hex(bytes[i + 1]) && hex(bytes[i + 2])) {
        out.push(parseInt(String.fromCharCode(bytes[i + 1], bytes[i + 2]), 16));
        i += 2;
        continue;
      }
    }
    out.push(b);
  }
  return new Uint8Array(out);
}

function paraBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function cabecalho(texto: string, nome: string) {
  const m = texto.replace(/\r?\n[ \t]+/g, " ").match(new RegExp(`^${nome}:\\s*(.+)$`, "im"));
  return m ? m[1].trim() : "";
}

export async function baixarAnexoBruto(
  conta: { imap_host: string; imap_port: number; usuario: string },
  senha: string, pasta: string, uid: number, parte: string, limiteBytes: number,
): Promise<{ base64: string; mime: string | null; nome: string | null }> {
  if (!/^\d+(\.\d+)*$/.test(parte)) throw new Error("Parte de anexo inválida.");
  const conn = await Deno.connectTls({ hostname: conta.imap_host, port: conta.imap_port });
  const leitor = new Leitor(conn);
  // base64 ocupa ~4/3 do arquivo: o literal pode vir até ~37% maior que o limite do arquivo.
  const limiteLiteral = Math.ceil(limiteBytes * 1.4);
  try {
    await leitor.linha(); // saudação "* OK ..."
    await comando(conn, leitor, "a1", `LOGIN ${quote(conta.usuario)} ${quote(senha)}`, 1024);
    await comando(conn, leitor, "a2", `EXAMINE ${quote(mutf7(pasta))}`, 1024 * 1024);
    const lits = await comando(conn, leitor, "a3", `UID FETCH ${uid} (BODY.PEEK[${parte}.MIME] BODY.PEEK[${parte}])`, limiteLiteral);
    const mimeLit = lits.find((l) => l.cabecalho.includes(`${parte}.MIME]`));
    const corpoLit = lits.find((l) => !l.cabecalho.includes(".MIME]"));
    if (!corpoLit) throw new Error("Anexo não encontrado nessa mensagem.");

    let cab = mimeLit ? new TextDecoder().decode(mimeLit.dados) : "";
    // Mensagem de parte única: a codificação fica no cabeçalho principal, não no .MIME.
    if (!/content-transfer-encoding/i.test(cab) && parte === "1") {
      const h = await comando(conn, leitor, "a4", `UID FETCH ${uid} BODY.PEEK[HEADER]`, 1024 * 1024);
      if (h[0]) cab = new TextDecoder().decode(h[0].dados);
    }
    const cte = cabecalho(cab, "content-transfer-encoding").toLowerCase();
    const contentType = cabecalho(cab, "content-type");
    const mime = contentType ? contentType.split(";")[0].trim().toLowerCase() : null;
    const nomeM = (cabecalho(cab, "content-disposition") + ";" + contentType).match(/(?:filename|name)="?([^";]+)"?/i);

    let base64: string;
    if (cte === "base64") {
      base64 = new TextDecoder().decode(corpoLit.dados).replace(/[\r\n\s]/g, "");
    } else if (cte === "quoted-printable") {
      base64 = paraBase64(decodificarQP(corpoLit.dados));
    } else {
      base64 = paraBase64(corpoLit.dados);
    }
    if (Math.floor(base64.length * 3 / 4) > limiteBytes) throw new Error("Anexo maior que 15 MB.");

    await conn.write(enc.encode("a9 LOGOUT\r\n")).catch(() => {});
    return { base64, mime, nome: nomeM ? nomeM[1].trim() : null };
  } finally {
    try { conn.close(); } catch { /* já fechada */ }
  }
}
