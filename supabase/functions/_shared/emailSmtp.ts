// Cifra/decifra de senha de caixa de e-mail (AES-GCM, chave EMAIL_CRED_KEY) + envio SMTP via
// nodemailer. Extraído de email-proxy/index.ts pra ser reaproveitado por cobranca-lembretes
// (envia pela caixa conectada do escritório em vez do domínio genérico do Actum, quando tem
// uma caixa batendo com organizations.email_cobranca). Comportamento idêntico ao que já
// existia em email-proxy — só movido de lugar.

import nodemailer from "npm:nodemailer@6";

const TIMEOUT_MS = 20000;

async function chaveCifra() {
  const b64 = Deno.env.get("EMAIL_CRED_KEY");
  if (!b64) throw new Error("EMAIL_CRED_KEY não configurada no projeto.");
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function cifrarSenha(texto: string) {
  const key = await chaveCifra();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(texto));
  return `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...new Uint8Array(buf)))}`;
}

export async function decifrarSenha(cifrado: string) {
  const [ivB64, dataB64] = cifrado.split(".");
  const key = await chaveCifra();
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(atob(dataB64), (c) => c.charCodeAt(0));
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(buf);
}

function comTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS, msg = "Tempo esgotado falando com o servidor de e-mail.") {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms)),
  ]);
}

export async function testarSmtp(conta: { smtp_host: string; smtp_port: number; usuario: string }, senha: string) {
  const transporte = nodemailer.createTransport({
    host: conta.smtp_host, port: conta.smtp_port, secure: true,
    auth: { user: conta.usuario, pass: senha },
    connectionTimeout: TIMEOUT_MS, greetingTimeout: TIMEOUT_MS, socketTimeout: TIMEOUT_MS,
  });
  await comTimeout(transporte.verify());
}

export async function enviarSmtp(
  conta: { nome: string; endereco: string; smtp_host: string; smtp_port: number; usuario: string },
  senha: string,
  opts: {
    to: string[];
    cc?: string[];
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
    inReplyTo?: string;
    references?: string;
    attachments?: { filename: string; content: string; encoding: string; contentType?: string }[];
  },
) {
  const transporte = nodemailer.createTransport({
    host: conta.smtp_host, port: conta.smtp_port, secure: true,
    auth: { user: conta.usuario, pass: senha },
    connectionTimeout: TIMEOUT_MS, greetingTimeout: TIMEOUT_MS, socketTimeout: TIMEOUT_MS,
  });
  const info = await comTimeout(transporte.sendMail({
    from: `"${conta.nome}" <${conta.endereco}>`,
    to: opts.to.join(", "),
    cc: opts.cc && opts.cc.length ? opts.cc.join(", ") : undefined,
    subject: opts.subject,
    text: opts.text || undefined,
    html: opts.html || undefined,
    attachments: opts.attachments,
    replyTo: opts.replyTo || undefined,
    inReplyTo: opts.inReplyTo || undefined,
    references: opts.references || undefined,
  }), TIMEOUT_MS, "Tempo esgotado enviando o e-mail.");
  return { messageId: (info as any)?.messageId ?? null };
}

// Erro do provedor (nodemailer/imapflow) em pt-BR pro usuário — nunca o texto cru do servidor.
export function erroAmigavel(err: unknown): string {
  const e = err as { message?: string; code?: string; authenticationFailed?: boolean; responseText?: string; responseCode?: number };
  const bruto = `${e?.message ?? ""} ${e?.responseText ?? ""} ${e?.code ?? ""}`.toLowerCase();
  if (e?.authenticationFailed || e?.code === "EAUTH" || /authenticationfailed|invalid credentials|auth|login|535|command failed/.test(bruto)) {
    return "E-mail ou senha incorretos. Se a conta usa verificação em 2 etapas, crie uma senha de app no provedor e use ela aqui.";
  }
  if (/enotfound|getaddrinfo|dns/.test(bruto)) return "Servidor não encontrado. Confira o endereço de entrada/saída.";
  if (/econnrefused|econnreset|timeout|timed out|etimedout|abort/.test(bruto)) return "O servidor de e-mail não respondeu. Confira servidor e porta, ou tente de novo em instantes.";
  return "Falha ao falar com o servidor de e-mail. Tente de novo em instantes.";
}

export function ehErroAuth(err: unknown): boolean {
  const e = err as { authenticationFailed?: boolean; code?: string; message?: string; responseText?: string };
  const bruto = `${e?.message ?? ""} ${e?.responseText ?? ""} ${e?.code ?? ""}`.toLowerCase();
  return !!e?.authenticationFailed || e?.code === "EAUTH" || /authenticationfailed|invalid credentials|535/.test(bruto);
}
