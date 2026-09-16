// Trava contra carding: sem isso, uma conta trial (criada em segundos, sem verificação)
// tinha chamadas ilimitadas pra testar card_token_id de cartão roubado contra a API real do
// Mercado Pago — achado real do qa-guardian, confirmado ao vivo (10/10 chamadas passaram sem
// bloqueio). Contador de falhas seguidas por org; ao bater o limite, bloqueia por um tempo.
// Reaproveitado pelas 3 Edge Functions que cobram (criar-assinatura, criar-pagamento-cartao,
// criar-pix) — um lugar só, mesmo espírito de _shared/pagamentoAvulso.ts.
import { createClient } from "npm:@supabase/supabase-js@2";

const LIMITE_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 30;

export async function checarBloqueioPagamento(admin: ReturnType<typeof createClient>, orgId: string) {
  const { data: org } = await admin.from("organizations").select("bloqueado_pagamento_ate").eq("id", orgId).maybeSingle();
  if (org?.bloqueado_pagamento_ate && new Date(org.bloqueado_pagamento_ate) > new Date()) {
    const ate = new Date(org.bloqueado_pagamento_ate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `Muitas tentativas de pagamento seguidas. Tenta de novo depois de ${ate}, ou fala com o suporte.`;
  }
  return null;
}

export async function registrarTentativaFalha(admin: ReturnType<typeof createClient>, orgId: string) {
  const { data: org } = await admin.from("organizations").select("tentativas_pagamento_falhas").eq("id", orgId).maybeSingle();
  const tentativas = (org?.tentativas_pagamento_falhas ?? 0) + 1;
  const bloqueando = tentativas >= LIMITE_TENTATIVAS;
  await admin
    .from("organizations")
    .update({
      tentativas_pagamento_falhas: bloqueando ? 0 : tentativas,
      ...(bloqueando ? { bloqueado_pagamento_ate: new Date(Date.now() + BLOQUEIO_MINUTOS * 60000).toISOString() } : {}),
    })
    .eq("id", orgId);
}

export async function registrarTentativaSucesso(admin: ReturnType<typeof createClient>, orgId: string) {
  await admin.from("organizations").update({ tentativas_pagamento_falhas: 0, bloqueado_pagamento_ate: null }).eq("id", orgId);
}
