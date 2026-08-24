// Recebe o webhook da Asaas quando uma cobrança é paga — marca o honorário como "Pago"
// sozinho, sem precisar de importação de extrato pra quem usa cobrança automática.
// Sem verify_jwt: quem chama é a Asaas, não um usuário logado nosso. Casa pelo
// asaas_charge_id (id da cobrança, único globalmente do lado da Asaas) — mesmo padrão do
// d4sign-webhook (casa por d4sign_uuid, sem precisar identificar a org antes de achar a linha).
//
// Configuração: depois de deployar, cadastra essa URL como webhook em Asaas → Integrações →
// Webhooks, escutando os eventos PAYMENT_RECEIVED e PAYMENT_CONFIRMED.
//
// Deploy: supabase functions deploy asaas-webhook --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const EVENTOS_PAGO = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];

Deno.serve(async (req) => {
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const evento = body?.event;
    const chargeId = body?.payment?.id;
    if (!evento || !chargeId) return new Response("ignorado: sem event/payment.id", { status: 200 });
    if (!EVENTOS_PAGO.includes(evento)) return new Response("ignorado: evento não mapeado", { status: 200 });

    await admin.from("honorarios").update({ status: "Pago" }).eq("asaas_charge_id", chargeId);
    return new Response("ok", { status: 200 });
  } catch (err) {
    return new Response(`erro: ${(err as Error).message}`, { status: 500 });
  }
});
