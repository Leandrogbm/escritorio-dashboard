// Login com limite de tentativas por e-mail (tabela login_tentativas + registrar_falha_login).
// A tela chama isto em vez de signInWithPassword direto, pra regra valer no servidor — só na
// tela, recarregar a página zerava o contador. ponytail: o endpoint direto do GoTrue continua
// aberto pra quem chama a API na mão; ali segura o rate limit por IP do próprio Supabase Auth.
// Fechar isso de vez exige o Password Verification Hook (plano Team do Supabase).
//
// Ações:
//   { email, password }      -> tenta logar; devolve { session } ou erro com esperar_segundos
//   { acao: "desbloquear" }  -> com JWT válido (sessão de recovery depois de redefinir a
//                               senha), limpa o bloqueio do próprio e-mail. Ter a sessão já
//                               prova que é o dono do e-mail.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MSG_BLOQUEADO = "Acesso bloqueado por excesso de tentativas. Use \"Esqueci minha senha\" para redefinir e liberar o acesso, ou peça ao administrador do escritório.";

function msgEspera(segundos: number) {
  const min = Math.ceil(segundos / 60);
  return `Muitas tentativas erradas. Tente de novo em ${min} minuto${min > 1 ? "s" : ""}.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));

    if (body.acao === "desbloquear") {
      const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
      const { data, error } = await admin.auth.getUser(jwt ?? "");
      if (error || !data.user?.email) return json({ error: "Sessão inválida." }, 401);
      await admin.from("login_tentativas").delete().eq("email", data.user.email.toLowerCase());
      return json({ ok: true });
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) return json({ error: "Informe e-mail e senha." }, 400);

    const { data: estado } = await admin.from("login_tentativas").select("*").eq("email", email).maybeSingle();
    if (estado?.bloqueado) return json({ error: MSG_BLOQUEADO, bloqueado: true }, 423);
    if (estado?.bloqueado_ate) {
      const falta = Math.ceil((new Date(estado.bloqueado_ate).getTime() - Date.now()) / 1000);
      if (falta > 0) return json({ error: msgEspera(falta), esperar_segundos: falta }, 429);
    }

    // Cliente anon novo por requisição: signInWithPassword guarda sessão no cliente.
    const anon = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });

    if (!error && data.session) {
      if (estado) await admin.from("login_tentativas").delete().eq("email", email);
      return json({ session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
    }

    // Só credencial errada conta como tentativa — e-mail não confirmado, rate limit do
    // Supabase etc. passam direto sem punir o usuário.
    const credencialErrada = error?.code === "invalid_credentials" || /invalid login credentials/i.test(error?.message ?? "");
    if (!credencialErrada) {
      return json({ error: error?.message ?? "Não foi possível entrar." }, error?.status ?? 500);
    }
    const { data: r, error: rpcErr } = await admin.rpc("registrar_falha_login", { p_email: email });
    if (rpcErr) throw rpcErr;
    if (r.bloqueado) return json({ error: MSG_BLOQUEADO, bloqueado: true }, 423);
    if (r.bloqueado_ate) {
      const falta = Math.ceil((new Date(r.bloqueado_ate).getTime() - Date.now()) / 1000);
      return json({ error: msgEspera(falta), esperar_segundos: falta }, 429);
    }
    const restantes = 5 - r.falhas;
    return json({ error: `E-mail ou senha inválidos.${restantes <= 2 ? ` ${restantes} tentativa${restantes > 1 ? "s" : ""} antes de uma pausa.` : ""}` }, 401);
  } catch (err) {
    return json({ error: (err as Error).message ?? "Erro inesperado." }, 500);
  }
});
