// Gera um pagamento PIX pré-pago por período (3/6/12 meses) — trilho separado da assinatura
// recorrente de cartão (mercado-pago-criar-assinatura): PIX não tem token salvo pra cobrar de
// novo sozinho, então "meses" pré-paga um período de acesso de uma vez, não uma assinatura.
// Chamada pelo admin/sócio da própria empresa, autenticada (JWT), mesmo padrão de
// mercado-pago-criar-assinatura. Preço vem sempre de plan_limits (nunca do que o client
// mandou) — desconto aplicado em cima disso, nunca embutido no valor recebido.
//
// Devolve o QR code (point_of_interaction.transaction_data) pro client mostrar — a confirmação
// de verdade só acontece quando mercado-pago-webhook consultar a API e achar status='approved'
// (metadata.tipo='actum_pix_prepago'), nunca com base na resposta síncrona daqui.
//
// Deploy: supabase functions deploy mercado-pago-criar-pix
// Secret necessário: supabase secrets set MERCADO_PAGO_ACCESS_TOKEN=<access-token-de-produção>

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mesmos números que src/config/planos.js usa só pra exibir — desconto de verdade é aplicado
// aqui, no servidor.
const DESCONTO_PIX: Record<number, number> = { 3: 0.03, 6: 0.04, 12: 0.05 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) return new Response(JSON.stringify({ error: "Pagamento via PIX ainda não foi configurado. Fale com o suporte." }), { status: 503, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });

    const { data: profile } = await admin.from("profiles").select("org_id, role").eq("id", user.id).maybeSingle();
    if (!profile || !["admin", "socio"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Só admin ou sócio pode pagar a assinatura." }), { status: 403, headers: corsHeaders });
    }

    const { plano, meses } = await req.json();
    const mesesNum = Number(meses);
    if (!plano || !DESCONTO_PIX[mesesNum]) {
      return new Response(JSON.stringify({ error: "Escolha um plano e um período válido (3, 6 ou 12 meses)." }), { status: 400, headers: corsHeaders });
    }

    // Preço vem do banco, nunca do que o client mandou. 'gratis' não é pagável.
    const { data: limite } = await admin.from("plan_limits").select("plano, valor_mensal").eq("plano", plano).maybeSingle();
    if (!limite || Number(limite.valor_mensal) <= 0) {
      return new Response(JSON.stringify({ error: "Plano inválido." }), { status: 400, headers: corsHeaders });
    }
    const valor = Math.round(Number(limite.valor_mensal) * mesesNum * (1 - DESCONTO_PIX[mesesNum]) * 100) / 100;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let pixRes: Response;
    try {
      pixRes = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_amount: valor,
          payment_method_id: "pix",
          description: `Actum — Plano ${limite.plano} (${mesesNum} meses via PIX)`,
          payer: { email: user.email },
          external_reference: profile.org_id,
          // sem underscore nas chaves de metadata — o Mercado Pago normaliza (remove
          // underscore) na volta, ver comentário em mercado-pago-webhook.
          metadata: { tipo: "actum_pix_prepago", meses: mesesNum, plano: limite.plano },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      const timedOut = (err as Error).name === "AbortError";
      return new Response(JSON.stringify({ error: timedOut ? "O Mercado Pago demorou demais pra responder. Tenta de novo." : `Falha ao gerar o PIX: ${(err as Error).message}` }), { status: 504, headers: corsHeaders });
    } finally {
      clearTimeout(timeout);
    }
    const payment = await pixRes.json().catch(() => null);
    const qr = payment?.point_of_interaction?.transaction_data;
    if (!pixRes.ok || !qr?.qr_code) {
      return new Response(JSON.stringify({ error: payment?.message ?? "Não foi possível gerar o PIX. Tenta de novo." }), { status: 502, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({ ok: true, payment_id: payment.id, qr_code: qr.qr_code, qr_code_base64: qr.qr_code_base64, valor }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
