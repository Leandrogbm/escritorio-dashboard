// Lembrete automático de cobrança: pra cada honorário em aberto/vencido, manda e-mail pro
// cliente 3 dias antes do vencimento, no dia, e 3 dias depois (vencido). Roda 1x/dia via
// pg_cron (ver migration 20260928020000_lembretes_cobranca.sql), chamada com x-cron-secret
// (mesmo padrão de datajud-sync). Sem plataforma de pagamento de terceiro: o e-mail leva o
// Pix "copia e cola" do próprio escritório quando organizations.pix_chave está configurada.
//
// Deploy: supabase functions deploy cobranca-lembretes --no-verify-jwt
// Secrets: RESEND_API_KEY (mesmo já usado por admin-reset-password), COBRANCA_CRON_SECRET
//   (mesmo valor gravado no Vault como cobranca_cron_secret, ver migration).

import { createClient } from "npm:@supabase/supabase-js@2";
import { gerarPixCopiaECola } from "../_shared/pix.ts";
import { decifrarSenha, enviarSmtp, ehErroAuth, erroAmigavel } from "../_shared/emailSmtp.ts";

type Tipo = "antes" | "dia" | "depois";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function fmtData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
function fmtValor(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Todo valor dinâmico interpolado no HTML do e-mail (nome, org, payload Pix) precisa passar
// por aqui — vem de dado de cliente/organização, nunca confiar sem escapar.
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function enviarEmail(to: string, subject: string, html: string, orgNome: string, replyTo: string | null) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    // Sai pelo domínio do Actum (verificado no Resend) com o nome do escritório; a resposta do
    // cliente vai pro e-mail do financeiro do escritório (organizations.email_cobranca).
    body: JSON.stringify({ from: `${orgNome} <nao-responda@actumjus.com.br>`, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) throw new Error(`Falha ao enviar email: ${await res.text()}`);
}

function montarEmail(opts: {
  orgNome: string;
  clienteNome: string;
  valor: number;
  vencimento: string;
  tipo: Tipo;
  pixCopiaCola: string | null;
  referente: string;
  recebedor: string;
  temResposta: boolean;
}) {
  const { orgNome, clienteNome, valor, vencimento, tipo, pixCopiaCola, referente, temResposta } = opts;
  const org = escapeHtml(orgNome);
  const primeiroNome = escapeHtml((clienteNome || "").trim().split(/\s+/)[0] || "");
  const ref = escapeHtml(referente);
  const assunto =
    tipo === "antes"
      ? `${orgNome}: seus honorários vencem em breve (${fmtData(vencimento)})`
      : tipo === "dia"
      ? `${orgNome}: seus honorários vencem hoje`
      : `${orgNome}: honorários em aberto`;
  const abertura =
    tipo === "antes" ? "Lembrete da sua mensalidade, que vence em breve."
      : tipo === "dia" ? "Sua mensalidade vence hoje."
      : "Sua mensalidade ainda consta em aberto.";
  const pixBloco = pixCopiaCola
    ? `<p style="margin:16px 0 8px">Para pagar, copie o código abaixo e cole no app do seu banco em <strong>Pix → Pix Copia e Cola</strong>:</p>
       <pre style="background:#F2F0E9;border:1px solid #DCD7C9;padding:12px;border-radius:6px;font-family:monospace;font-size:12px;word-break:break-all;white-space:pre-wrap;margin:0">${escapeHtml(pixCopiaCola)}</pre>`
    : "";
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1B3328;max-width:560px">
  <p>Olá${primeiroNome ? `, ${primeiroNome}` : ""}! ${abertura}</p>
  <table style="border-collapse:collapse;margin:8px 0">
    <tr><td style="padding:4px 16px 4px 0;color:#5C6B60">Escritório</td><td style="padding:4px 0"><strong>${org}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#5C6B60">Referente a</td><td style="padding:4px 0"><strong>${ref}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#5C6B60">Valor</td><td style="padding:4px 0"><strong>${fmtValor(valor)}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#5C6B60">Vencimento</td><td style="padding:4px 0"><strong>${fmtData(vencimento)}</strong></td></tr>
  </table>
  ${pixBloco}
  <p style="margin-top:16px">Se já pagou, desconsidere. ${temResposta ? "Dúvidas, é só responder este e-mail." : "Dúvidas, fale com o escritório (este e-mail não recebe respostas)."}</p>
</div>`;
  return { assunto, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const segredo = req.headers.get("x-cron-secret");
  if (!segredo || segredo !== Deno.env.get("COBRANCA_CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Não autorizado." }), { status: 401, headers: corsHeaders });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { data: orgs, error: orgsErr } = await admin
      .from("organizations")
      .select("id, nome, pix_chave, pix_nome_recebedor, pix_cidade, email_cobranca")
      .eq("lembretes_cobranca", true);
    if (orgsErr) throw orgsErr;

    let enviados = 0;
    const erros: string[] = [];

    for (const org of orgs ?? []) {
      const { data: honorarios, error: honErr } = await admin
        .from("honorarios")
        .select("id, valor, vencimento, status, cliente_id, descricao_servico, clientes(nome, email, arquivado)")
        .eq("org_id", org.id)
        .in("status", ["Em aberto", "Vencido"]);
      if (honErr) {
        erros.push(`org ${org.id}: ${honErr.message}`);
        continue;
      }

      // Se o e-mail do financeiro (organizations.email_cobranca) bater com uma caixa conectada
      // (Configurações → Caixas de e-mail), manda por ela via SMTP — o domínio genérico do
      // Actum ainda não está verificado no Resend. Sem caixa: cai no Resend de sempre.
      let caixaCobranca: any = null;
      let senhaCaixa: string | null = null;
      if (org.email_cobranca) {
        const { data: caixas } = await admin.from("email_contas").select("*").eq("org_id", org.id).eq("status", "ok");
        caixaCobranca = (caixas ?? []).find((c: any) => (c.endereco || "").toLowerCase() === org.email_cobranca.toLowerCase()) ?? null;
        if (caixaCobranca) {
          const { data: seg } = await admin.from("email_contas_segredo").select("segredo_cifrado").eq("conta_id", caixaCobranca.id).maybeSingle();
          senhaCaixa = seg ? await decifrarSenha(seg.segredo_cifrado) : null;
          if (!senhaCaixa) caixaCobranca = null; // sem senha salva, não dá pra usar essa caixa
        }
      }

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      for (const h of honorarios ?? []) {
        const cliente = h.clientes as unknown as { nome: string; email: string | null; arquivado: boolean } | null;
        if (!cliente || cliente.arquivado || !cliente.email) continue;

        const venc = new Date(`${h.vencimento}T00:00:00`);
        const diffDias = Math.round((venc.getTime() - hoje.getTime()) / 86400000);

        // Janela em vez de dia exato: se o cron falhar num dia, o lembrete sai no seguinte (o
        // dedup abaixo garante 1 envio por tipo). "depois" para em 10 dias de atraso — ligar os
        // lembretes não deve disparar e-mail pra dívida antiga de meses.
        let tipo: Tipo | null = null;
        if (diffDias >= 1 && diffDias <= 3) tipo = "antes";
        else if (diffDias === 0) tipo = "dia";
        else if (diffDias <= -3 && diffDias >= -10) tipo = "depois";
        if (!tipo) continue;

        // Dedup: nunca manda o mesmo (honorario_id, tipo) duas vezes.
        const { data: jaEnviado } = await admin
          .from("cobranca_lembretes")
          .select("honorario_id")
          .eq("honorario_id", h.id)
          .eq("tipo", tipo)
          .maybeSingle();
        if (jaEnviado) continue;

        const pixCopiaCola =
          org.pix_chave && org.pix_nome_recebedor && org.pix_cidade
            ? gerarPixCopiaECola({
                chave: org.pix_chave,
                nomeRecebedor: org.pix_nome_recebedor,
                cidade: org.pix_cidade,
                valor: Number(h.valor),
                txid: h.id, // mesmo txid do "Cobrar via Pix" da tela — mesmo código nos dois
              })
            : null;
        const mesRef = new Date(`${h.vencimento}T00:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
        const referente = (h.descricao_servico as string | null)?.trim() || `honorários advocatícios de ${mesRef}`;

        const { assunto, html } = montarEmail({
          orgNome: org.nome,
          clienteNome: cliente.nome,
          valor: Number(h.valor),
          vencimento: h.vencimento,
          tipo,
          pixCopiaCola,
          referente,
          recebedor: org.pix_nome_recebedor || org.nome,
          temResposta: !!(caixaCobranca || org.email_cobranca),
        });

        try {
          if (caixaCobranca && senhaCaixa) {
            const info = await enviarSmtp(caixaCobranca, senhaCaixa, { to: [cliente.email], subject: assunto, html });
            await admin.from("email_enviados").insert({
              org_id: org.id, conta_id: caixaCobranca.id, enviado_por: null,
              destinatarios: [cliente.email], assunto, message_id: info.messageId,
            });
          } else {
            await enviarEmail(cliente.email, assunto, html, org.nome, org.email_cobranca || null);
          }
          await admin.from("cobranca_lembretes").insert({ honorario_id: h.id, tipo });
          enviados++;
        } catch (emailErr) {
          if (caixaCobranca && senhaCaixa && ehErroAuth(emailErr)) {
            await admin.from("email_contas").update({ status: "erro_auth", ultimo_erro: erroAmigavel(emailErr) }).eq("id", caixaCobranca.id);
          }
          erros.push(`honorario ${h.id} (${tipo}): ${(emailErr as Error).message}`);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, enviados, erros }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
