-- CRÍTICO: profiles_update permitia auto-promoção de cargo. A policy libera UPDATE na
-- própria linha (id = auth.uid()) pra edição normal de nome/avatar etc., mas "with check
-- (true)" não valida a linha nova — sem trigger, qualquer usuário logado (até recepção)
-- conseguia PATCH direto em /rest/v1/profiles trocando o próprio "role" pra 'admin'.
-- Achado real do qa-guardian, reproduzido ao vivo. Mesmo padrão de defesa que
-- organizations.plano (guard_organizations_protected_cols) e processos.confidencial
-- (guard_processos_confidencial) já usam.
create or replace function guard_profiles_role() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if is_platform_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  -- nunca muda de empresa pelo client (ver profiles_insert: mesma preocupação no insert).
  new.org_id := old.org_id;
  -- admin troca qualquer cargo (inclusive promovendo a admin). Sócio troca cargo de quem
  -- não é admin, pra outro cargo que não seja admin (mesma regra que a UI já aplica em
  -- cargoOptions()/podeGerenciar, agora garantida no banco). Qualquer outro caso (o
  -- próprio usuário editando a si mesmo, por exemplo) mantém o cargo como estava.
  if auth_role() = 'admin' then
    return new;
  elsif auth_role() = 'socio' and old.role <> 'admin' and new.role <> 'admin' then
    return new;
  end if;
  new.role := old.role;
  return new;
end;
$$;
create trigger trg_guard_profiles_role before update on profiles
  for each row execute function guard_profiles_role();
