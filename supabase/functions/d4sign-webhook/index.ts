// Recebe o postback da D4Sign quando um documento é assinado/finalizado/cancelado.
// A D4Sign dispara em FORM-DATA (não JSON) — ver docapi.d4sign.com.br/docs/webhook-postback.
// Sem verify_jwt: quem chama é a D4Sign, não um usuário logado nosso.
//
// Configuração: depois de deployar, cadastra essa URL como webhook do documento/cofre no
// painel da D4Sign (ou via endpoint de cadastro de webhook deles).
//
// Deploy: supabase functions deploy d4sign-webhook --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const form = await req.formData();
    const uuid = form.get("uuid")?.toString();
    const typePost = form.get("type_post")?.toString();
    if (!uuid || !typePost) return new Response("ignorado: sem uuid/type_post", { status: 200 });

    // 1 = documento finalizado (todo mundo assinou); 3 = cancelado; 4 = 1 signatário assinou
    // (documento pode ter mais gente pra assinar ainda).
    const status = typePost === "1" ? "finalizado" : typePost === "3" ? "cancelado" : typePost === "4" ? "assinado_parcial" : null;
    if (!status) return new Response("ignorado: type_post não mapeado", { status: 200 });

    await admin.from("documentos_assinatura").update({ status, atualizado_em: new Date().toISOString() }).eq("d4sign_uuid", uuid);
    return new Response("ok", { status: 200 });
  } catch (err) {
    return new Response(`erro: ${(err as Error).message}`, { status: 500 });
  }
});
