import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

// Sessão real (Supabase Auth) + o perfil (org, nome, role) do usuário logado.
// profile === undefined enquanto carrega; null se a sessão existe mas o admin
// ainda não criou a linha em `profiles` pra essa conta.
export function useAuth() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  // login de cliente final (Portal do Cliente) — só populado quando a conta não é de
  // colaborador (profile null) e existe uma linha em cliente_logins pra ela.
  const [clienteAcesso, setClienteAcesso] = useState(undefined);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [platformAdminChecked, setPlatformAdminChecked] = useState(false);
  // true depois de abrir o link do email de "redefinir senha" — supabase-js já cria uma
  // sessão nesse momento, então precisamos distinguir isso de um login normal.
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    // Link do email de recovery aponta pro próprio app (?token_hash=...&type=recovery) em vez
    // do endpoint do Supabase — assim o token só é consumido por JS de um browser de verdade,
    // não pelo GET automático de scanners de segurança de email (Outlook Safe Links e cia,
    // que "clicam" o link sozinhos e invalidam o token antes do usuário abrir o email).
    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get("token_hash");
    const type = params.get("type");
    if (token_hash && type) {
      window.history.replaceState({}, "", window.location.pathname);
      supabase.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
        if (!error && type === "recovery") setRecovery(true);
      });
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Chave só no user id, não no objeto session inteiro — supabase-js renova o token
  // sozinho toda vez que a aba volta a ficar visível (alt+tab, trocar de app), o que troca
  // a referência de `session` sem trocar de usuário. Sem esse cuidado, cada renovação de
  // token disparava um "profile = undefined" (tela de carregando piscando) e um refetch à
  // toa — e por uma fração de segundo allowedModules ficava vazio lá em cima no App.jsx,
  // o que empurrava a aba ativa de volta pra a primeira da lista.
  const userId = session?.user?.id;

  const carregarProfile = (uid) =>
    supabase
      .from("profiles")
      .select("*, organizations(nome, suspenso, cnpj, inscricao_municipal, aliquota_iss, cep, logradouro, numero, complemento, bairro, cidade, uf, termos_aceite)")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        // só vale a pena checar cliente_logins quando NÃO é colaborador — a maioria das
        // contas é de equipe, então isso evita um select à toa em todo login normal.
        if (data) { setClienteAcesso(null); return; }
        supabase
          .from("cliente_logins")
          .select("cliente_id, cliente:clientes(nome), organizations(nome)")
          .eq("user_id", uid)
          .maybeSingle()
          .then(({ data: acesso }) => setClienteAcesso(acesso ?? null));
      });

  useEffect(() => {
    if (session === undefined) return;
    if (!session) { setProfile(null); setClienteAcesso(null); setIsPlatformAdmin(false); setPlatformAdminChecked(true); return; }
    setProfile(undefined);
    setClienteAcesso(undefined);
    setPlatformAdminChecked(false);
    carregarProfile(session.user.id);
    // platform_org_metrics é security definer e checa isso por dentro — não vaza nada,
    // mas ainda perguntamos explicitamente pra decidir qual painel mostrar no client.
    supabase.rpc("is_platform_admin").then(({ data }) => { setIsPlatformAdmin(!!data); setPlatformAdminChecked(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return {
    session,
    profile,
    clienteAcesso,
    isPlatformAdmin,
    loading: session === undefined || (session && (profile === undefined || clienteAcesso === undefined || !platformAdminChecked)),
    recovery,
    clearRecovery: () => setRecovery(false),
    signOut: () => supabase.auth.signOut(),
    // pra MinhaEmpresaTab recarregar o profile (nome/logo/endereço) depois de salvar,
    // sem precisar de reload da página.
    refreshProfile: () => userId && carregarProfile(userId),
  };
}
