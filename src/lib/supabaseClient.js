import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  // passkey (Face ID / digital / Windows Hello): feature experimental do supabase-js, exige
  // habilitar em Authentication > Passkeys no dashboard do projeto (RP ID = domínio, RP
  // Origins = https://mysaldo.com.br) antes de registerPasskey()/signInWithPasskey() funcionarem.
  { auth: { experimental: { passkey: true } } }
);
