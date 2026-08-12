import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

// Sessão real (Supabase Auth) + o perfil (org, nome, role) do usuário logado.
// profile === undefined enquanto carrega; null se a sessão existe mas o admin
// ainda não criou a linha em `profiles` pra essa conta.
export function useAuth() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
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

  useEffect(() => {
    if (session === undefined) return;
    if (!session) { setProfile(null); setIsPlatformAdmin(false); setPlatformAdminChecked(true); return; }
    setProfile(undefined);
    setPlatformAdminChecked(false);
    supabase
      .from("profiles")
      .select("*, organizations(nome)")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
    // platform_org_metrics é security definer e checa isso por dentro — não vaza nada,
    // mas ainda perguntamos explicitamente pra decidir qual painel mostrar no client.
    supabase.rpc("is_platform_admin").then(({ data }) => { setIsPlatformAdmin(!!data); setPlatformAdminChecked(true); });
  }, [session]);

  return {
    session,
    profile,
    isPlatformAdmin,
    loading: session === undefined || (session && (profile === undefined || !platformAdminChecked)),
    recovery,
    clearRecovery: () => setRecovery(false),
    signOut: () => supabase.auth.signOut(),
  };
}
