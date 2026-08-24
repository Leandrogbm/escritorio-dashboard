// Envia um documento já cadastrado em documentos_processo pra assinatura via D4Sign — usa
// as credenciais DA PRÓPRIA EMPRESA (organizations.d4sign_token/crypt_key/safe_uuid), não
// uma conta compartilhada da plataforma. Cada escritório cria a conta e o "cofre" (safe) na
// D4Sign e cola as credenciais em Configurações → Assinatura eletrônica.
//
// ATENÇÃO: construído a partir da documentação oficial (docapi.d4sign.com.br), sem teste
// contra conta real (não temos credencial de teste) — o formato de resposta do upload em
// especial pode precisar de ajuste na primeira tentativa de verdade.
//
// Deploy: supabase functions deploy d4sign-enviar

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const D4SIGN_BASE = "https://secure.d4sign.com.br/api/v1"; // trocar por sandbox.d4sign.com.br pra testar

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });
    }
    const { data: callerProfile } = await admin.from("profiles").select("org_id, role").eq("id", caller.id).single();
    const { data: platformAdminRow } = await admin.from("platform_admins").select("user_id").eq("user_id", caller.id).maybeSingle();
    const ehPlatformAdmin = !!platformAdminRow;
    if (!ehPlatformAdmin && !(callerProfile && ["admin", "socio"].includes(callerProfile.role))) {
      return new Response(JSON.stringify({ error: "Só admin ou sócio podem enviar documento pra assinatura." }), { status: 403, headers: corsHeaders });
    }

    const { documentoId, orgId, signatarios } = await req.json();
    if (!documentoId || !Array.isArray(signatarios) || signatarios.length === 0) {
      return new Response(JSON.stringify({ error: "documentoId e ao menos 1 signatário (nome+email) são obrigatórios." }), { status: 400, headers: corsHeaders });
    }
    const targetOrgId = ehPlatformAdmin && orgId ? orgId : callerProfile?.org_id;

    const { data: org } = await admin.from("organizations").select("d4sign_token, d4sign_crypt_key, d4sign_safe_uuid").eq("id", targetOrgId).single();
    if (!org?.d4sign_token || !org?.d4sign_crypt_key || !org?.d4sign_safe_uuid) {
      return new Response(JSON.stringify({ error: "Configure as credenciais D4Sign da empresa em Configurações antes de enviar." }), { status: 400, headers: corsHeaders });
    }
    const auth = `tokenAPI=${org.d4sign_token}&cryptKey=${org.d4sign_crypt_key}`;

    const { data: doc } = await admin.from("documentos_processo").select("nome_arquivo, storage_path").eq("id", documentoId).single();
    if (!doc) {
      return new Response(JSON.stringify({ error: "Documento não encontrado." }), { status: 404, headers: corsHeaders });
    }
    const { data: arquivo, error: dlErr } = await admin.storage.from("documentos-processo").download(doc.storage_path);
    if (dlErr) {
      return new Response(JSON.stringify({ error: `Não consegui baixar o arquivo do Storage: ${dlErr.message}` }), { status: 400, headers: corsHeaders });
    }

    // 1) upload do arquivo pro cofre
    const form = new FormData();
    form.append("file", arquivo, doc.nome_arquivo);
    const upRes = await fetch(`${D4SIGN_BASE}/documents/${org.d4sign_safe_uuid}/upload?${auth}`, { method: "POST", body: form });
    const upBody = await upRes.json().catch(() => ({}));
    if (!upRes.ok) {
      return new Response(JSON.stringify({ error: `D4Sign recusou o upload: ${JSON.stringify(upBody)}` }), { status: 400, headers: corsHeaders });
    }
    // Nome do campo com o uuid do documento varia entre versões da API D4Sign — tenta os
    // formatos mais comuns documentados; se nenhum bater, devolve o corpo cru pra debugar.
    const docUuid = upBody.uuid ?? upBody.uuidDoc ?? upBody[0]?.uuidDoc ?? upBody[0]?.uuid;
    if (!docUuid) {
      return new Response(JSON.stringify({ error: `Upload foi, mas não achei o uuid do documento na resposta: ${JSON.stringify(upBody)}` }), { status: 500, headers: corsHeaders });
    }

    // 2) cadastra signatários
    const signersRes = await fetch(`${D4SIGN_BASE}/documents/${docUuid}/createlist?${auth}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signers: signatarios.map((s: { nome: string; email: string }) => ({
          email: s.email, act: "1", foreign: "0", certificadoicpbr: "0", assinatura_presencial: "0",
        })),
      }),
    });
    if (!signersRes.ok) {
      return new Response(JSON.stringify({ error: `D4Sign recusou os signatários: ${await signersRes.text()}` }), { status: 400, headers: corsHeaders });
    }

    // 3) envia pra assinatura
    const sendRes = await fetch(`${D4SIGN_BASE}/documents/${docUuid}/sendtosigner?${auth}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skip_email: "0", workflow: "0", message: "Documento enviado pelo mysaldo para assinatura." }),
    });
    if (!sendRes.ok) {
      return new Response(JSON.stringify({ error: `D4Sign recusou o envio: ${await sendRes.text()}` }), { status: 400, headers: corsHeaders });
    }

    const { error: insertErr } = await admin.from("documentos_assinatura").insert({
      org_id: targetOrgId,
      documento_processo_id: documentoId,
      d4sign_uuid: docUuid,
      nome_arquivo: doc.nome_arquivo,
      signatarios,
    });
    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
