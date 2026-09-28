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

async function enviarEmail(to: string, subject: string, html: string, orgNome: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: `${orgNome} <nao-responda@actumjus.com.br>`, to, subject, html }),
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
}) {
  const { orgNome, clienteNome, valor, vencimento, tipo, pixCopiaCola } = opts;
  const orgNomeHtml = escapeHtml(orgNome);
  const clienteNomeHtml = escapeHtml(clienteNome);
  const assunto =
    tipo === "antes"
      ? `Lembrete: honorário vence em 3 dias — ${orgNome}`
      : tipo === "dia"
      ? `Honorário vence hoje — ${orgNome}`
      : `Honorário em atraso — ${orgNome}`;
  const situacao =
    tipo === "antes"
      ? `Seu honorário no valor de <strong>${fmtValor(valor)}</strong> vence em <strong>${fmtData(vencimento)}</strong>.`
      : tipo === "dia"
      ? `Seu honorário no valor de <strong>${fmtValor(valor)}</strong> vence hoje, <strong>${fmtData(vencimento)}</strong>.`
      : `Seu honorário no valor de <strong>${fmtValor(valor)}</strong>, com vencimento em <strong>${fmtData(vencimento)}</strong>, está em atraso.`;
  const pixBloco = pixCopiaCola
    ? `<p>Pague via Pix copiando o código abaixo no app do seu banco:</p>
       <pre style="background:#f4f4f4;padding:12px;border-radius:6px;font-family:monospace;font-size:12px;word-break:break-all;white-space:pre-wrap;">${escapeHtml(pixCopiaCola)}</pre>`
    : "";
  const html = `<p>Olá, ${clienteNomeHtml}!</p><p>${situacao}</p>${pixBloco}<p>Qualquer dúvida, responda este e-mail ou entre em contato com ${orgNomeHtml}.</p>`;
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
      .select("id, nome, pix_chave, pix_nome_recebedor, pix_cidade")
      .eq("lembretes_cobranca", true);
    if (orgsErr) throw orgsErr;

    let enviados = 0;
    const erros: string[] = [];

    for (const org of orgs ?? []) {
      const { data: honorarios, error: honErr } = await admin
        .from("honorarios")
        .select("id, valor, vencimento, status, cliente_id, clientes(nome, email, arquivado)")
        .eq("org_id", org.id)
        .in("status", ["Em aberto", "Vencido"]);
      if (honErr) {
        erros.push(`org ${org.id}: ${honErr.message}`);
        continue;
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
              })
            : null;

        const { assunto, html } = montarEmail({
          orgNome: org.nome,
          clienteNome: cliente.nome,
          valor: Number(h.valor),
          vencimento: h.vencimento,
          tipo,
          pixCopiaCola,
        });

        try {
          await enviarEmail(cliente.email, assunto, html, org.nome);
          await admin.from("cobranca_lembretes").insert({ honorario_id: h.id, tipo });
          enviados++;
        } catch (emailErr) {
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
