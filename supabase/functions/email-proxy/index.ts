// Proxy pra caixas de e-mail conectadas por IMAP/SMTP (Zoho é o provedor piloto). Mesma
// razão de existir que trello-proxy: a senha da caixa nunca pode chegar no browser depois
// de salva — fica cifrada em email_contas_segredo, só esse endpoint (service role) decifra
// e fala com o provedor. org_id vem SEMPRE do perfil autenticado, nunca do body.
//
// Ações: salvar_conta, remover_conta, testar, pastas, listar, ler, anexo, mover, marcar,
// excluir, arquivar, enviar.
//
// ponytail: sem "modo suporte" de platform admin aqui (diferente de admin-create-user) —
// trello-proxy, a referência pedida pra esse proxy, também não tem; org_id fixo no perfil
// do chamador é a defesa mais simples. Se precisar (platform admin dando suporte numa caixa
// de e-mail de outra empresa), replicar o padrão orgId-no-body-só-se-platform-admin de
// admin-create-user/index.ts.
//
// ponytail: imapflow tem um bug conhecido (postalsys/imapflow#401) travando em fetch de
// mensagem inteira >~1MB dentro do edge-runtime do Supabase. Contornado nunca baixando a
// mensagem inteira: só bodyStructure/envelope (metadados) e, por parte, `download()` de UM
// pedaço por vez (texto OU um anexo específico) com corte de tamanho manual no loop do
// stream. Se voltar a travar em produção, a saída documentada é um client IMAP cru sobre
// Deno.connectTls (LOGIN/SELECT/UID FETCH BODY.PEEK[parte]) — mais código, mais controle.
//
// Deploy: supabase functions deploy email-proxy
// Secret necessário: EMAIL_CRED_KEY (32 bytes em base64, ex.: `openssl rand -base64 32`)

import { createClient } from "npm:@supabase/supabase-js@2";
import { ImapFlow } from "npm:imapflow@1";
import { cifrarSenha, decifrarSenha, testarSmtp, enviarSmtp, erroAmigavel } from "../_shared/emailSmtp.ts";
import { baixarAnexoBruto } from "../_shared/imapBruto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEOUT_MS = 20000;
const CARGOS_VALIDOS = ["socio", "advogado", "financeiro", "recepcao"];

function erroResposta(mensagem: string, status = 400) {
  return new Response(JSON.stringify({ error: mensagem }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function ok(dados: unknown) {
  return new Response(JSON.stringify(dados), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ── Helpers de bytes ─────────────────────────────────────────────────────

function concatUint8(chunks: Uint8Array[]) {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

function uint8ToBase64(bytes: Uint8Array) {
  let binary = "";
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) binary += String.fromCharCode(...bytes.subarray(i, i + passo));
  return btoa(binary);
}

function comTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS, msg = "Tempo esgotado conectando na caixa de e-mail.") {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms)),
  ]);
}

// ── IMAP ─────────────────────────────────────────────────────────────────

function novoClienteImap(conta: { imap_host: string; imap_port: number; usuario: string }, senha: string) {
  return new ImapFlow({
    host: conta.imap_host,
    port: conta.imap_port,
    secure: true,
    auth: { user: conta.usuario, pass: senha },
    logger: false,
    socketTimeout: TIMEOUT_MS,
  });
}

async function testarImap(conta: { imap_host: string; imap_port: number; usuario: string }, senha: string) {
  const client = novoClienteImap(conta, senha);
  await comTimeout(client.connect());
  await client.logout().catch(() => {});
}

function achatarPartes(node: any, acc: any[] = []) {
  if (!node) return acc;
  if (node.childNodes?.length) {
    for (const filho of node.childNodes) achatarPartes(filho, acc);
  } else {
    acc.push(node);
  }
  return acc;
}

function tipoMime(parte: any) {
  const tipo = String(parte.type || "").toLowerCase();
  return tipo.includes("/") ? tipo : `${tipo}/${String(parte.subtype || "").toLowerCase()}`;
}

function ehAnexo(parte: any) {
  const disp = (parte.disposition || "").toLowerCase();
  if (disp === "attachment") return true;
  if (parte.dispositionParameters?.filename || parte.parameters?.name) return true;
  const tipo = tipoMime(parte);
  return tipo !== "text/plain" && tipo !== "text/html";
}

function ehTextoSemDisposicaoDeAnexo(parte: any) {
  return tipoMime(parte).startsWith("text/")
    && (parte.disposition || "").toLowerCase() !== "attachment";
}

function nomeAnexo(parte: any) {
  return parte.dispositionParameters?.filename || parte.parameters?.name || null;
}

function temAnexoStructure(node: any): boolean {
  if (!node) return false;
  if (node.childNodes?.length) return node.childNodes.some(temAnexoStructure);
  return ehAnexo(node);
}

function enderecoObj(e: any) {
  return { nome: e?.name || "", email: e?.address || "" };
}

async function baixarParteTexto(client: ImapFlow, uid: number, part: string, limite: number) {
  const { content, meta } = await comTimeout(client.download(String(uid), part, { uid: true }));
  const chunks: Uint8Array[] = [];
  let total = 0, truncado = false;
  for await (const chunk of content as AsyncIterable<Uint8Array>) {
    if (total + chunk.length > limite) {
      chunks.push(chunk.subarray(0, Math.max(0, limite - total)));
      truncado = true;
      (content as any).destroy?.();
      break;
    }
    chunks.push(chunk);
    total += chunk.length;
  }
  const buf = concatUint8(chunks);
  const charset = (meta?.charset || "utf-8").toLowerCase();
  let texto: string;
  try { texto = new TextDecoder(charset).decode(buf); } catch { texto = new TextDecoder("utf-8").decode(buf); }
  return { texto, truncado };
}

async function acaoListarPastas(conta: any, senha: string) {
  const client = novoClienteImap(conta, senha);
  await comTimeout(client.connect());
  try {
    const pastas = await comTimeout(client.list()) as any[];
    return pastas.map((p) => ({
      path: p.path,
      name: p.name,
      specialUse: p.specialUse ?? null,
      flags: Array.from(p.flags || []),
      delimiter: p.delimiter ?? "/",
      noSelect: p.flags?.has("\\Noselect") ?? false,
    }));
  } finally {
    await client.logout().catch(() => {});
  }
}

async function acaoListar(conta: any, senha: string, pasta: string, antesDeUid: number | undefined, limite: number, busca: string) {
  const client = novoClienteImap(conta, senha);
  await comTimeout(client.connect());
  try {
    const lock = await client.getMailboxLock(pasta || "INBOX");
    try {
      const uidNext = Number(client.mailbox?.uidNext ?? 1);
      let teto = Math.min(uidNext - 1, antesDeUid ? antesDeUid - 1 : Number.MAX_SAFE_INTEGER);
      const uids: number[] = [];
      let blocosBuscados = 0;
      while (teto >= 1 && uids.length <= limite && blocosBuscados < 5) {
        const inicio = Math.max(1, teto - 1999);
        const criterio: any = { uid: `${inicio}:${teto}` };
        if (busca) criterio.text = busca;
        const encontrados = await comTimeout(client.search(criterio, { uid: true })) as number[];
        encontrados.sort((a, b) => b - a);
        uids.push(...encontrados.slice(0, limite + 1 - uids.length));
        teto = inicio - 1;
        blocosBuscados++;
      }
      const pagina = uids.slice(0, limite);
      const proximoCursor = uids.length > limite
        ? pagina[pagina.length - 1]
        : teto >= 1
          ? pagina.length ? pagina[pagina.length - 1] : teto + 1
          : null;

      const itens: any[] = [];
      if (pagina.length) {
        for await (const msg of client.fetch(pagina, { envelope: true, flags: true, bodyStructure: true }, { uid: true })) {
          itens.push({
            uid: msg.uid,
            message_id: msg.envelope?.messageId ?? null,
            de: msg.envelope?.from?.[0] ? enderecoObj(msg.envelope.from[0]) : null,
            para: (msg.envelope?.to ?? []).map((t: any) => t.address).filter(Boolean).join(", "),
            assunto: msg.envelope?.subject ?? "",
            data: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
            lido: msg.flags?.has("\\Seen") ?? false,
            sinalizado: msg.flags?.has("\\Flagged") ?? false,
            tem_anexo: temAnexoStructure(msg.bodyStructure),
          });
        }
      }
      itens.sort((a, b) => b.uid - a.uid);
      return { itens, proximoCursor };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

async function acaoMover(conta: any, senha: string, uid: number, pasta: string, destino: string) {
  const client = novoClienteImap(conta, senha);
  await comTimeout(client.connect());
  try {
    const lock = await client.getMailboxLock(pasta || "INBOX");
    try {
      const pastas = await comTimeout(client.list()) as any[];
      if (!pastas.some((p) => p.path === destino && !p.flags?.has("\\Noselect"))) {
        throw new Error("Pasta de destino não encontrada.");
      }
      await comTimeout(client.messageMove(String(uid), destino, { uid: true }));
      return { ok: true };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

async function acaoMarcar(conta: any, senha: string, uid: number, pasta: string, estado: string) {
  const client = novoClienteImap(conta, senha);
  await comTimeout(client.connect());
  try {
    const lock = await client.getMailboxLock(pasta || "INBOX");
    try {
      const operacoes: Record<string, () => Promise<unknown>> = {
        lido: () => client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }),
        nao_lido: () => client.messageFlagsRemove(String(uid), ["\\Seen"], { uid: true }),
        sinalizado: () => client.messageFlagsAdd(String(uid), ["\\Flagged"], { uid: true }),
        nao_sinalizado: () => client.messageFlagsRemove(String(uid), ["\\Flagged"], { uid: true }),
      };
      const operar = operacoes[estado];
      if (!operar) throw new Error("Ação de mensagem inválida.");
      await comTimeout(operar());
      return { ok: true };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

async function acaoLer(conta: any, senha: string, uid: number, pasta: string) {
  const LIMITE = 2 * 1024 * 1024;
  const client = novoClienteImap(conta, senha);
  await comTimeout(client.connect());
  try {
    const lock = await client.getMailboxLock(pasta || "INBOX");
    try {
      const msg: any = await comTimeout(client.fetchOne(String(uid), { envelope: true, bodyStructure: true }, { uid: true }));
      if (!msg) throw new Error("Mensagem não encontrada.");
      const partes = achatarPartes(msg.bodyStructure);
      const tipoParte = tipoMime;
      const htmlPart = partes.find((p) => tipoParte(p) === "text/html" && !ehAnexo(p))
        || partes.find((p) => tipoParte(p) === "text/html" && ehTextoSemDisposicaoDeAnexo(p));
      const textPart = partes.find((p) => tipoParte(p) === "text/plain" && !ehAnexo(p))
        || partes.find((p) => tipoParte(p) === "text/plain" && ehTextoSemDisposicaoDeAnexo(p))
        || partes.find(ehTextoSemDisposicaoDeAnexo);
      const anexos = partes.filter(ehAnexo).map((p) => ({
        partId: p.part || (!msg.bodyStructure?.childNodes?.length ? "1" : undefined),
        nome: nomeAnexo(p) || `anexo-${p.part || "1"}`, tamanho: p.size ?? 0, mime: tipoMime(p),
      }));

      let html: string | null = null, texto: string | null = null, truncado = false;
      if (htmlPart) {
        const parteId = htmlPart.part || (!msg.bodyStructure?.childNodes?.length ? "1" : undefined);
        const r = await baixarParteTexto(client, uid, parteId, LIMITE);
        html = r.texto; truncado = truncado || r.truncado;
      }
      if (textPart && !html) {
        const parteId = textPart.part || (!msg.bodyStructure?.childNodes?.length ? "1" : undefined);
        const r = await baixarParteTexto(client, uid, parteId, LIMITE);
        texto = r.texto; truncado = truncado || r.truncado;
      }

      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }).catch(() => {});

      return {
        uid, message_id: msg.envelope?.messageId ?? null,
        de: msg.envelope?.from?.[0] ? enderecoObj(msg.envelope.from[0]) : null,
        para: (msg.envelope?.to ?? []).map(enderecoObj),
        cc: (msg.envelope?.cc ?? []).map(enderecoObj),
        assunto: msg.envelope?.subject ?? "",
        data: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
        html, texto, anexos, truncado,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

async function acaoAnexo(conta: any, senha: string, uid: number, partId: string, pasta: string) {
  const r = await comTimeout(
    baixarAnexoBruto(conta, senha, pasta || "INBOX", uid, partId, 15 * 1024 * 1024),
    90000, "O anexo demorou demais pra baixar. Tente de novo.",
  );
  return { nome: r.nome || `anexo-${partId}`, mime: r.mime || "application/octet-stream", base64: r.base64 };
}

// Pasta especial (Lixeira/Arquivo) pelo flag IMAP oficial; sem flag, pelos nomes mais comuns.
const NOMES_ESPECIAIS: Record<string, string[]> = {
  "\\Trash": ["trash", "lixeira", "deleted items", "deleted messages", "itens excluídos", "itens excluidos"],
  "\\Archive": ["archive", "arquivo", "arquivos", "archives"],
};
function acharPastaEspecial(pastas: any[], flag: string) {
  const validas = pastas.filter((p) => !p.flags?.has("\\Noselect"));
  return validas.find((p) => p.specialUse === flag)
    || validas.find((p) => (NOMES_ESPECIAIS[flag] || []).includes(String(p.name || p.path).toLowerCase()));
}

function uidsDoBody(body: any): string {
  const lista = Array.isArray(body.uids) ? body.uids : body.uid ? [body.uid] : [];
  const validos = lista.map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 200);
  if (!validos.length) throw new Error("Nenhuma mensagem selecionada.");
  return validos.join(",");
}

// Excluir: fora da Lixeira, move pra ela; dentro da Lixeira, apaga de vez.
async function acaoExcluir(conta: any, senha: string, uids: string, pasta: string) {
  const client = novoClienteImap(conta, senha);
  await comTimeout(client.connect());
  try {
    const pastas = await comTimeout(client.list()) as any[];
    const lixeira = acharPastaEspecial(pastas, "\\Trash");
    const lock = await client.getMailboxLock(pasta || "INBOX");
    try {
      if (!lixeira || lixeira.path === pasta) {
        await comTimeout(client.messageDelete(uids, { uid: true }));
        return { ok: true, permanente: true };
      }
      await comTimeout(client.messageMove(uids, lixeira.path, { uid: true }));
      return { ok: true, permanente: false };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

// Arquivar: move pra pasta de arquivo; se o provedor não tiver uma, cria "Arquivo".
async function acaoArquivar(conta: any, senha: string, uids: string, pasta: string) {
  const client = novoClienteImap(conta, senha);
  await comTimeout(client.connect());
  try {
    const pastas = await comTimeout(client.list()) as any[];
    let destino = acharPastaEspecial(pastas, "\\Archive")?.path;
    if (!destino) {
      await comTimeout(client.mailboxCreate("Arquivo")).catch(() => {});
      destino = "Arquivo";
    }
    if (destino === pasta) return { ok: true };
    const lock = await client.getMailboxLock(pasta || "INBOX");
    try {
      await comTimeout(client.messageMove(uids, destino, { uid: true }));
      return { ok: true, destino };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

// ── Autorização ──────────────────────────────────────────────────────────

function podeUsarConta(conta: any, perfil: { org_id: string; role: string }) {
  return conta.org_id === perfil.org_id && (perfil.role === "admin" || (conta.cargos || []).includes(perfil.role));
}

function ehAdminOuSocio(perfil: { role: string }) {
  return perfil.role === "admin" || perfil.role === "socio";
}

// ── Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !caller) return erroResposta("Não autenticado.", 401);

    const { data: perfil } = await admin.from("profiles").select("org_id, role").eq("id", caller.id).single();
    if (!perfil) return erroResposta("Perfil não encontrado.", 403);

    const body = await req.json().catch(() => ({}));
    const { acao } = body;

    // Ações que criam/removem/testam a conta: só quem administra Configurações.
    if (acao === "salvar_conta") {
      if (!ehAdminOuSocio(perfil)) return erroResposta("Só administrador(a) ou sócio(a) conecta uma caixa de e-mail.", 403);
      const { id, slot, nome, endereco, imap_host, imap_port, smtp_host, smtp_port, usuario, senha, cargos } = body;
      if (!slot || ![1, 2].includes(Number(slot))) return erroResposta("Slot inválido (1 ou 2).");
      if (!nome || !endereco || !imap_host || !imap_port || !smtp_host || !smtp_port || !usuario) {
        return erroResposta("Preencha nome, endereço, servidor/porta IMAP e SMTP e usuário.");
      }
      const cargosLimpos = Array.isArray(cargos) ? cargos.filter((c: string) => CARGOS_VALIDOS.includes(c)) : [];

      let contaExistente: any = null;
      if (id) {
        const { data } = await admin.from("email_contas").select("*").eq("id", id).eq("org_id", perfil.org_id).maybeSingle();
        if (!data) return erroResposta("Caixa não encontrada.", 404);
        contaExistente = data;
      }
      if (!contaExistente && !senha) return erroResposta("Senha é obrigatória pra conectar uma caixa nova.");

      const cfgTeste = { imap_host, imap_port: Number(imap_port), smtp_host, smtp_port: Number(smtp_port), usuario };
      let status = contaExistente?.status ?? "ok";
      let ultimoErro: string | null = contaExistente?.ultimo_erro ?? null;

      if (senha) {
        try {
          await testarImap(cfgTeste, senha);
          await testarSmtp(cfgTeste, senha);
          status = "ok"; ultimoErro = null;
        } catch (err) {
          return erroResposta(erroAmigavel(err));
        }
      }

      const linha = {
        org_id: perfil.org_id, slot: Number(slot), nome, endereco,
        imap_host, imap_port: Number(imap_port), smtp_host, smtp_port: Number(smtp_port),
        usuario, cargos: cargosLimpos.length ? cargosLimpos : ["admin", "socio"],
        status, ultimo_erro: ultimoErro,
      };

      let contaId = contaExistente?.id;
      if (contaExistente) {
        const { error } = await admin.from("email_contas").update(linha).eq("id", contaExistente.id);
        if (error) return erroResposta("Não foi possível salvar a caixa. Verifique se o slot já está em uso.");
      } else {
        const { data, error } = await admin.from("email_contas").insert(linha).select("id").single();
        if (error) return erroResposta("Não foi possível salvar a caixa. Verifique se o slot já está em uso.");
        contaId = data.id;
      }

      if (senha) {
        const cifrado = await cifrarSenha(senha);
        const { error: segErr } = await admin.from("email_contas_segredo").upsert({ conta_id: contaId, segredo_cifrado: cifrado });
        if (segErr) return erroResposta("Caixa salva, mas não consegui guardar a senha. Tente reconectar.");
      }

      return ok({ ok: true, conta: { id: contaId, slot: Number(slot), nome, endereco, status } });
    }

    if (acao === "remover_conta") {
      if (!ehAdminOuSocio(perfil)) return erroResposta("Só administrador(a) ou sócio(a) desconecta uma caixa de e-mail.", 403);
      const { conta_id } = body;
      const { data: conta } = await admin.from("email_contas").select("id, org_id").eq("id", conta_id).maybeSingle();
      if (!conta || conta.org_id !== perfil.org_id) return erroResposta("Caixa não encontrada.", 404);
      const { error } = await admin.from("email_contas").delete().eq("id", conta_id);
      if (error) return erroResposta("Não consegui remover essa caixa.");
      return ok({ ok: true });
    }

    // Ações de uso (ler/enviar/etc.): carrega a conta + senha uma vez.
    const { conta_id } = body;
    if (!conta_id) return erroResposta("conta_id é obrigatório.");
    const { data: conta } = await admin.from("email_contas").select("*").eq("id", conta_id).maybeSingle();
    if (!conta) return erroResposta("Caixa não encontrada.", 404);

    if (acao === "testar") {
      if (!ehAdminOuSocio(perfil) || conta.org_id !== perfil.org_id) return erroResposta("Sem permissão pra essa caixa.", 403);
      const { data: seg } = await admin.from("email_contas_segredo").select("segredo_cifrado").eq("conta_id", conta.id).maybeSingle();
      if (!seg) return erroResposta("Caixa sem senha salva.", 400);
      const senha = await decifrarSenha(seg.segredo_cifrado);
      let resultado: { ok: boolean; erro?: string };
      try {
        await testarImap(conta, senha);
        await testarSmtp(conta, senha);
        resultado = { ok: true };
        await admin.from("email_contas").update({ status: "ok", ultimo_erro: null }).eq("id", conta.id);
      } catch (err) {
        const msg = erroAmigavel(err);
        resultado = { ok: false, erro: msg };
        await admin.from("email_contas").update({ status: "erro_auth", ultimo_erro: msg }).eq("id", conta.id);
      }
      return ok(resultado);
    }

    // Demais ações exigem acesso de uso normal (org + cargo liberado pra essa caixa).
    if (perfil.role !== "admin") {
      const { data: permissaoEmails } = await admin.from("role_permissions").select("module")
        .eq("org_id", perfil.org_id).eq("role", perfil.role).eq("module", "emails").maybeSingle();
      if (!permissaoEmails) return erroResposta("Seu perfil não tem acesso ao módulo de e-mails.", 403);
    }
    if (!podeUsarConta(conta, perfil)) return erroResposta("Sem permissão pra essa caixa.", 403);

    const { data: seg } = await admin.from("email_contas_segredo").select("segredo_cifrado").eq("conta_id", conta.id).maybeSingle();
    if (!seg) return erroResposta("Caixa sem senha salva. Reconecte em Configurações.", 400);
    const senha = await decifrarSenha(seg.segredo_cifrado);

    if (acao === "pastas") {
      try {
        return ok({ pastas: await acaoListarPastas(conta, senha) });
      } catch (err) {
        return erroResposta(`Não consegui carregar as pastas. ${erroAmigavel(err)}`, 502);
      }
    }

    if (acao === "listar") {
      const { pasta, antesDeUid, limite, busca } = body;
      try {
        const limiteSeguro = Math.max(1, Math.min(Math.floor(Number(limite) || 25), 100));
        const resultado = await acaoListar(conta, senha, pasta || "INBOX", antesDeUid, limiteSeguro, String(busca || "").trim());
        return ok(resultado);
      } catch (err) {
        await admin.from("email_contas").update({ status: "erro_auth", ultimo_erro: erroAmigavel(err) }).eq("id", conta.id);
        return erroResposta(`Não consegui ler a caixa de entrada. ${erroAmigavel(err)}`, 502);
      }
    }

    if (acao === "ler") {
      const { uid, pasta } = body;
      if (!uid) return erroResposta("uid é obrigatório.");
      try {
        const resultado = await acaoLer(conta, senha, Number(uid), pasta || "INBOX");
        return ok(resultado);
      } catch (err) {
        return erroResposta(`Não consegui abrir essa mensagem. ${erroAmigavel(err)}`, 502);
      }
    }

    if (acao === "anexo") {
      const { uid, partId, pasta } = body;
      if (!uid || !partId) return erroResposta("uid e partId são obrigatórios.");
      try {
        const resultado = await acaoAnexo(conta, senha, Number(uid), String(partId), pasta || "INBOX");
        return ok(resultado);
      } catch (err) {
        return erroResposta(`Não consegui baixar o anexo. ${erroAmigavel(err)}`, 502);
      }
    }

    if (acao === "mover") {
      const { uid, pasta, destino } = body;
      if (!uid || !destino) return erroResposta("uid e destino são obrigatórios.");
      try {
        return ok(await acaoMover(conta, senha, Number(uid), pasta || "INBOX", String(destino)));
      } catch (err) {
        return erroResposta(`Não consegui mover essa mensagem. ${erroAmigavel(err)}`, 502);
      }
    }

    if (acao === "marcar") {
      const { uid, pasta, estado } = body;
      if (!uid || !estado) return erroResposta("uid e estado são obrigatórios.");
      try {
        return ok(await acaoMarcar(conta, senha, Number(uid), pasta || "INBOX", String(estado)));
      } catch (err) {
        return erroResposta(`Não consegui atualizar essa mensagem. ${erroAmigavel(err)}`, 502);
      }
    }

    if (acao === "excluir" || acao === "arquivar") {
      let uids: string;
      try { uids = uidsDoBody(body); } catch (err) { return erroResposta((err as Error).message); }
      const pasta = String(body.pasta || "INBOX");
      try {
        return ok(acao === "excluir" ? await acaoExcluir(conta, senha, uids, pasta) : await acaoArquivar(conta, senha, uids, pasta));
      } catch (err) {
        return erroResposta(`Não consegui ${acao === "excluir" ? "excluir" : "arquivar"}. ${erroAmigavel(err)}`, 502);
      }
    }

    if (acao === "enviar") {
      const { para, cc, assunto, texto, html, anexos, inReplyTo, references } = body;
      if (!Array.isArray(para) || para.length === 0) return erroResposta("Informe ao menos um destinatário.");
      if (!assunto) return erroResposta("Assunto é obrigatório.");
      const destinatarios = [...para, ...(Array.isArray(cc) ? cc : [])];
      if (destinatarios.length > 20) return erroResposta("No máximo 20 destinatários por envio.");
      const listaAnexos = Array.isArray(anexos) ? anexos : [];
      const totalAnexosBytes = listaAnexos.reduce((s: number, a: any) => s + Math.ceil(((a.base64 || "").length) * 3 / 4), 0);
      if (totalAnexosBytes > 10 * 1024 * 1024) return erroResposta("Anexos passaram de 10 MB no total.");

      const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
      const { count } = await admin.from("email_enviados").select("id", { count: "exact", head: true })
        .eq("conta_id", conta.id).gte("created_at", inicioHoje.toISOString());
      if ((count ?? 0) >= 200) return erroResposta("Essa caixa já atingiu o limite de 200 envios hoje.");

      let info: { messageId: string | null };
      try {
        info = await enviarSmtp(conta, senha, {
          to: para,
          cc: Array.isArray(cc) ? cc : undefined,
          subject: assunto,
          text: texto || undefined,
          html: html || undefined,
          attachments: listaAnexos.map((a: any) => ({ filename: a.nome, content: a.base64, encoding: "base64", contentType: a.mime })),
          inReplyTo: inReplyTo || undefined,
          references: references || undefined,
        });
      } catch (err) {
        return erroResposta(`Não consegui enviar. ${erroAmigavel(err)}`, 502);
      }

      await admin.from("email_enviados").insert({
        org_id: conta.org_id, conta_id: conta.id, enviado_por: caller.id,
        destinatarios, assunto, message_id: info?.messageId ?? null, anexos: listaAnexos.map((a: any) => a.nome),
      });

      return ok({ ok: true, message_id: info?.messageId ?? null });
    }

    return erroResposta("Ação inválida.");
  } catch (err) {
    console.error(err);
    return erroResposta("Erro inesperado. Tente de novo em instantes.", 500);
  }
});
