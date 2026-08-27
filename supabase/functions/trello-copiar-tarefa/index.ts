// Manda uma cópia de tarefa recém-criada pro Trello (1 via — editar/mover/concluir no
// Trello NÃO volta pro Actum, de propósito, pra não ter conflito de sincronização nos dois
// sentidos). Chamado pelo trigger notificar_trello_nova_tarefa (schema.sql) via pg_net, em
// TODO insert de tarefas — Kanban, TarefasPanel de processo, ou o trigger prazo→tarefa.
//
// Trello aceita chamada direta do browser (Key+Token na query string, CORS liberado — é
// como os próprios Power-Ups funcionam), mas isso ficaria server-side de qualquer forma
// porque quem chama é o trigger do Postgres, não o client.
//
// Deploy: supabase functions deploy trello-copiar-tarefa --no-verify-jwt
// (--no-verify-jwt: quem chama é o trigger via pg_net, com x-webhook-secret, não um usuário)

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, x-webhook-secret" };
const TIMEOUT_MS = 15000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const secret = req.headers.get("x-webhook-secret");
    if (!secret || secret !== Deno.env.get("INTERNAL_WEBHOOK_SECRET")) {
      return new Response(JSON.stringify({ error: "Não autorizado." }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { tarefaId } = await req.json();

    const { data: tarefa } = await admin.from("tarefas").select("id, org_id, titulo, descricao, processo:processos(numero)").eq("id", tarefaId).single();
    if (!tarefa) return new Response(JSON.stringify({ ok: true, skip: "tarefa não encontrada" }), { headers: corsHeaders });

    const { data: integ } = await admin.from("integracoes").select("trello_key, trello_token, trello_list_id").eq("org_id", tarefa.org_id).single();
    if (!integ?.trello_key || !integ?.trello_token || !integ?.trello_list_id) {
      return new Response(JSON.stringify({ ok: true, skip: "Trello não conectado nessa org" }), { headers: corsHeaders });
    }

    const params = new URLSearchParams({
      key: integ.trello_key,
      token: integ.trello_token,
      idList: integ.trello_list_id,
      name: tarefa.titulo,
      desc: [tarefa.processo?.numero && `Processo: ${tarefa.processo.numero}`, tarefa.descricao].filter(Boolean).join("\n\n"),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`https://api.trello.com/1/cards?${params.toString()}`, { method: "POST", signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      return new Response(JSON.stringify({ error: `Trello retornou ${res.status}: ${corpo.slice(0, 300)}` }), { status: 502, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (err) {
    // Nunca deixa isso quebrar a criação da tarefa em si — o trigger só dispara e segue.
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
