// API pública pra integração externa (ERP/CRM) — autentica por chave (Authorization: Bearer
// sk_live_...), não por sessão de usuário (por isso --no-verify-jwt no deploy). Endpoints
// enxutos de propósito: cobre os casos de uso mais comuns (ler/criar cliente, ler processo/
// honorário), não é um espelho de toda a API interna.
//
// Deploy: supabase functions deploy api-gateway --no-verify-jwt
//
// GET  /api-gateway/clientes
// POST /api-gateway/clientes        body: { nome, tipo, documento?, celular?, email?, ... }
// GET  /api-gateway/processos
// GET  /api-gateway/honorarios

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(texto: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization") ?? "";
    const chave = authHeader.replace("Bearer ", "").trim();
    if (!chave.startsWith("sk_live_")) {
      return new Response(JSON.stringify({ error: "Chave de API ausente ou inválida." }), { status: 401, headers: corsHeaders });
    }
    const hash = await sha256Hex(chave);
    const { data: apiKey } = await admin.from("api_keys").select("id, org_id").eq("key_hash", hash).maybeSingle();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Chave de API inválida ou revogada." }), { status: 401, headers: corsHeaders });
    }
    admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id).then(() => {}); // fire-and-forget

    const url = new URL(req.url);
    const recurso = url.pathname.split("/").filter(Boolean).pop(); // último segmento: "clientes", "processos", "honorarios"

    if (recurso === "clientes" && req.method === "GET") {
      const { data, error } = await admin.from("clientes").select("*").eq("org_id", apiKey.org_id).order("nome");
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (recurso === "clientes" && req.method === "POST") {
      const body = await req.json();
      const { data, error } = await admin.from("clientes").insert({ ...body, org_id: apiKey.org_id }).select().single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
      return new Response(JSON.stringify(data), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (recurso === "processos" && req.method === "GET") {
      const { data, error } = await admin.from("processos").select("*, cliente:clientes(nome)").eq("org_id", apiKey.org_id).order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (recurso === "honorarios" && req.method === "GET") {
      const { data, error } = await admin.from("honorarios").select("*, cliente:clientes(nome)").eq("org_id", apiKey.org_id).order("vencimento", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Endpoint não encontrado. Use /clientes, /processos ou /honorarios." }), { status: 404, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
