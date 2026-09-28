-- Repasse de honorários aos sócios: percentual de rateio por sócio (role = 'socio'),
-- só admin/sócio configura ou vê. Idempotente.

create table if not exists repasse_socios (
  -- Sem FK pra organizations de propósito: FK pra profiles E organizations faz o PostgREST
  -- tratar esta tabela como ponte profiles<->organizations, e todo embed
  -- profiles->organizations(...) (useAuth, Edge Functions) quebrava por ambiguidade
  -- (PGRST201) — derrubou o login de todo mundo em 2026-09-28. org_id segue garantido por
  -- set_org_id + RLS; apagar a empresa apaga os profiles, que apagam estas linhas.
  org_id uuid not null,
  profile_id uuid not null references profiles(id) on delete cascade,
  percentual numeric(5,2) not null check (percentual >= 0 and percentual <= 100),
  primary key (org_id, profile_id)
);

alter table repasse_socios enable row level security;

drop trigger if exists trg_set_org_id on repasse_socios;
create trigger trg_set_org_id before insert on repasse_socios for each row execute function set_org_id();

drop trigger if exists trg_guard_org_id on repasse_socios;
create trigger trg_guard_org_id before update on repasse_socios for each row execute function guard_org_id_immutable();

drop policy if exists repasse_socios_sel on repasse_socios;
create policy repasse_socios_sel on repasse_socios for select using (
  (org_id = auth_org_id() and auth_role() in ('admin', 'socio')) or is_platform_admin()
);
drop policy if exists repasse_socios_ins on repasse_socios;
create policy repasse_socios_ins on repasse_socios for insert with check (
  (org_id = auth_org_id() and auth_role() in ('admin', 'socio')
    and exists (select 1 from profiles p where p.id = repasse_socios.profile_id and p.org_id = repasse_socios.org_id))
  or is_platform_admin()
);
drop policy if exists repasse_socios_upd on repasse_socios;
create policy repasse_socios_upd on repasse_socios for update
  using ((org_id = auth_org_id() and auth_role() in ('admin', 'socio')) or is_platform_admin())
  with check (
    (org_id = auth_org_id() and auth_role() in ('admin', 'socio')
      and exists (select 1 from profiles p where p.id = repasse_socios.profile_id and p.org_id = repasse_socios.org_id))
    or is_platform_admin()
  );
drop policy if exists repasse_socios_del on repasse_socios;
create policy repasse_socios_del on repasse_socios for delete using (
  (org_id = auth_org_id() and auth_role() in ('admin', 'socio')) or is_platform_admin()
);

-- Se a tabela já foi criada com a FK pra organizations, remove (ver comentário acima).
alter table repasse_socios drop constraint if exists repasse_socios_org_id_fkey;
