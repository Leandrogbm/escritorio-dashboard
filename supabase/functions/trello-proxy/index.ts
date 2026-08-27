// Proxy pro Trello — QuadroTab.jsx (aba "Quadro de tarefas") é visível pra QUALQUER cargo
// com o módulo liberado, então a Key/Token do Trello da organização NUNCA pode ir pro
// browser de quem só está usando o quadro (só quem mexe em Configurações → Integrações,
// admin/sócio, digita a própria credencial — isso é inevitável e diferente). Esse endpoint
// busca a credencial aqui dentro (service role, nunca devolvida na resposta) e repassa a
// chamada pro Trello — o cliente só manda a AÇÃO, nunca a chave.
//
// Deploy: supabase functions deploy trello-proxy

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });
    }
    const { data: callerProfile } = await admin.from("profiles").select("org_id").eq("id", caller.id).single();
    if (!callerProfile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado." }), { status: 403, headers: corsHeaders });
    }

    // org_id vem SEMPRE do perfil autenticado, nunca de um campo mandado pelo client — senão
    // um usuário poderia tentar ler/mexer no quadro Trello de outra organização.
    const { data: integ } = await admin.from("integracoes").select("trello_key, trello_token, trello_board_id").eq("org_id", callerProfile.org_id).single();
    if (!integ?.trello_key || !integ?.trello_token || !integ?.trello_board_id) {
      return new Response(JSON.stringify({ error: "Trello não conectado nessa organização." }), { status: 400, headers: corsHeaders });
    }

    const { acao, cardId, idList, nome } = await req.json();
    const q = `key=${integ.trello_key}&token=${integ.trello_token}`;

    let url, method = "GET";
    switch (acao) {
      case "listar_listas":
        url = `https://api.trello.com/1/boards/${integ.trello_board_id}/lists?${q}&fields=name`;
        break;
      case "listar_cards":
        url = `https://api.trello.com/1/boards/${integ.trello_board_id}/cards?${q}&fields=name,desc,idList`;
        break;
      case "mover_card":
        if (!cardId || !idList) return new Response(JSON.stringify({ error: "cardId e idList são obrigatórios." }), { status: 400, headers: corsHeaders });
        url = `https://api.trello.com/1/cards/${cardId}?${q}&idList=${idList}`;
        method = "PUT";
        break;
      case "criar_card":
        if (!idList || !nome) return new Response(JSON.stringify({ error: "idList e nome são obrigatórios." }), { status: 400, headers: corsHeaders });
        url = `https://api.trello.com/1/cards?${q}&idList=${idList}&name=${encodeURIComponent(nome)}`;
        method = "POST";
        break;
      case "excluir_card":
        if (!cardId) return new Response(JSON.stringify({ error: "cardId é obrigatório." }), { status: 400, headers: corsHeaders });
        url = `https://api.trello.com/1/cards/${cardId}?${q}`;
        method = "DELETE";
        break;
      default:
        return new Response(JSON.stringify({ error: "Ação inválida." }), { status: 400, headers: corsHeaders });
    }

    const res = await fetch(url, { method });
    const corpo = await res.text();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Trello retornou ${res.status}: ${corpo.slice(0, 300)}` }), { status: 502, headers: corsHeaders });
    }
    return new Response(corpo, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Erro inesperado." }), { status: 500, headers: corsHeaders });
  }
});
