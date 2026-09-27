-- Limite de tentativas de login por e-mail (conta existindo ou não — e-mail errado também
-- conta, pra não virar oráculo de "esse e-mail existe"). Só a Edge Function `login` (service
-- role) lê/escreve: RLS ligada e sem policy nenhuma = invisível pra anon/authenticated.
create table if not exists login_tentativas (
  email text primary key,
  falhas int not null default 0,
  bloqueado_ate timestamptz,
  bloqueado boolean not null default false,
  atualizado_em timestamptz not null default now()
);
alter table login_tentativas enable row level security;

-- Atômico (1 statement por passo) pra rajada de tentativas em paralelo não "perder" falha.
-- Regra: 5ª falha espera 1 min, depois dobra a cada falha (2, 4, 8, 16 min); 10ª falha
-- bloqueia de vez — só sai redefinindo a senha. Falhas antigas (>24h sem erro) zeram a conta.
create or replace function registrar_falha_login(p_email text)
returns login_tentativas language plpgsql security definer set search_path = public as $$
declare r login_tentativas;
begin
  insert into login_tentativas (email, falhas) values (p_email, 1)
  on conflict (email) do update set
    falhas = case when not login_tentativas.bloqueado and login_tentativas.atualizado_em < now() - interval '24 hours'
                  then 1 else login_tentativas.falhas + 1 end,
    atualizado_em = now()
  returning * into r;

  if r.falhas >= 10 then
    update login_tentativas set bloqueado = true, bloqueado_ate = null where email = p_email returning * into r;
  elsif r.falhas >= 5 then
    update login_tentativas set bloqueado_ate = now() + make_interval(mins => power(2, r.falhas - 5)::int)
    where email = p_email returning * into r;
  end if;
  return r;
end $$;

revoke all on function registrar_falha_login(text) from public, anon, authenticated;
