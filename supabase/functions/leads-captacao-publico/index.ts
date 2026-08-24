// Recebe o formulário público de captação de leads (embutido via iframe no site do
// escritório, fora deste painel) e grava com service role — o formulário nunca fala direto
// com a tabela via anon key (sem policy de insert nela de propósito, ver schema.sql).
//
// Geocodifica a cidade via Nominatim (OpenStreetMap, gratuito) quando não vier lat/lng do
// navegador (geolocalização recusada/indisponível) — sem isso o mapa fica sem marcador pro
// lead que só informou a cidade.
//
// Sem verify_jwt: quem chama é um visitante anônimo do site do escritório, não um usuário
// logado nosso — a validação de "empresa existe" é feita na mão aqui dentro.
//
// Deploy: supabase functions deploy leads-captacao-publico --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // formulário roda embutido em domínio de terceiro (site do escritório)
  "Access-Control-Allow-Headers": "content-type",
};

const AREAS_VALIDAS = ["trabalhista", "familia", "tributario", "civel", "penal", "empresarial"];

async function geocodificar(cidade: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(cidade)}`;
    const res = await fetch(url, { headers: { "User-Agent": "mysaldo-leads-captacao/1.0 (contato@mysaldo.com.br)" } });
    if (!res.ok) {
      console.error("geocodificar: nominatim respondeu", res.status, await res.text().catch(() => ""));
      return null;
    }
    const body = await res.json();
    const hit = body?.[0];
    if (!hit) return null;
    return { lat: Number(hit.lat), lon: Number(hit.lon) };
  } catch (err) {
    console.error("geocodificar: falhou", (err as Error).message);
    return null; // geocoding é best-effort — sem coordenada, o lead ainda é salvo, só não aparece no mapa
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const { orgId, nome, contato, areaDireito, cidade, latitude, longitude, consentimentoLgpd } = body ?? {};

    if (!orgId || !nome?.trim() || !contato?.trim() || !areaDireito) {
      return new Response(JSON.stringify({ error: "Preencha nome, contato e área do direito." }), { status: 400, headers: corsHeaders });
    }
    if (!AREAS_VALIDAS.includes(areaDireito)) {
      return new Response(JSON.stringify({ error: "Área do direito inválida." }), { status: 400, headers: corsHeaders });
    }
    if (!consentimentoLgpd) {
      return new Response(JSON.stringify({ error: "É preciso autorizar o contato (consentimento LGPD) pra enviar." }), { status: 400, headers: corsHeaders });
    }

    const { data: org } = await admin.from("organizations").select("id").eq("id", orgId).maybeSingle();
    if (!org) {
      return new Response(JSON.stringify({ error: "Formulário mal configurado (empresa não encontrada)." }), { status: 400, headers: corsHeaders });
    }

    let lat = typeof latitude === "number" ? latitude : null;
    let lon = typeof longitude === "number" ? longitude : null;
    if ((lat == null || lon == null) && cidade?.trim()) {
      const geo = await geocodificar(cidade.trim());
      if (geo) { lat = geo.lat; lon = geo.lon; }
    }

    const { error: insErr } = await admin.from("leads_captacao").insert({
      org_id: orgId,
      nome: nome.trim(),
      contato: contato.trim(),
      area_direito: areaDireito,
      cidade: cidade?.trim() || null,
      latitude: lat,
      longitude: lon,
      origem: "formulario_site",
      consentimento_lgpd: true,
      consentimento_at: new Date().toISOString(),
    });
    if (insErr) {
      return new Response(JSON.stringify({ error: "Não consegui registrar seu contato. Tenta de novo em instantes." }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
