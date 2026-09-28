-- Feature "E-mails": até 2 caixas (IMAP/SMTP, ex. Zoho) conectadas por organização.
-- Idempotente. Só o email-proxy (service role) lê/escreve email_contas/email_contas_segredo
-- — nenhuma policy de insert/update/delete pra authenticated, mesmo espírito de
-- integracoes/trello: credencial nunca passa pelo client depois de salva.

create table if not exists email_contas (
  id uuid primary key default gen_random_uuid(),
  -- Sem FK pra profiles nesta tabela (só organizations) — evita o bug PGRST201 de
  -- 2026-09-28 (repasse_socios: FK pra profiles E organizations vira "ponte" ambígua pro
  -- PostgREST e derruba todo embed profiles->organizations, inclusive o login).
  org_id uuid not null references organizations(id) on delete cascade,
  slot smallint not null check (slot in (1, 2)),
  nome text not null,
  endereco text not null,
  transporte text not null default 'imap' check (transporte in ('imap')),
  imap_host text not null,
  imap_port int not null default 993,
  smtp_host text not null,
  smtp_port int not null default 465,
  usuario text not null,
  cargos text[] not null default '{admin,socio}',
  status text not null default 'ok' check (status in ('ok', 'erro_auth', 'erro')),
  ultimo_erro text,
  created_at timestamptz not null default now(),
  unique (org_id, slot)
);
alter table email_contas enable row level security;

drop trigger if exists trg_set_org_id on email_contas;
create trigger trg_set_org_id before insert on email_contas for each row execute function set_org_id();
drop trigger if exists trg_guard_org_id on email_contas;
create trigger trg_guard_org_id before update on email_contas for each row execute function guard_org_id_immutable();

drop policy if exists email_contas_sel on email_contas;
create policy email_contas_sel on email_contas for select using (
  is_platform_admin()
  or (org_id = auth_org_id() and has_module('emails') and (auth_role() = 'admin' or auth_role() = any(cargos)))
);
-- Sem policy de insert/update/delete: só o email-proxy (service role) grava, pra nunca
-- expor a senha em trânsito por uma chamada direta authenticated -> REST.

-- Senha cifrada (AES-GCM, chave EMAIL_CRED_KEY só no email-proxy) — RLS ligada, ZERO
-- policies: nem select authenticated, só service role enxerga essa tabela.
create table if not exists email_contas_segredo (
  conta_id uuid primary key references email_contas(id) on delete cascade,
  segredo_cifrado text not null
);
alter table email_contas_segredo enable row level security;

-- Auditoria de envio — conta_id/enviado_por podem ficar null se a conta/usuário for
-- removido depois (on delete set null), a linha de auditoria não é apagada.
create table if not exists email_enviados (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  conta_id uuid references email_contas(id) on delete set null,
  -- auth.users, não profiles — mesmo motivo do comentário acima em email_contas.
  enviado_por uuid references auth.users(id) on delete set null,
  destinatarios text[] not null,
  assunto text,
  message_id text,
  anexos text[],
  created_at timestamptz not null default now()
);
alter table email_enviados enable row level security;

drop trigger if exists trg_set_org_id on email_enviados;
create trigger trg_set_org_id before insert on email_enviados for each row execute function set_org_id();
drop trigger if exists trg_guard_org_id on email_enviados;
create trigger trg_guard_org_id before update on email_enviados for each row execute function guard_org_id_immutable();

drop policy if exists email_enviados_sel on email_enviados;
create policy email_enviados_sel on email_enviados for select using (
  is_platform_admin()
  or (
    org_id = auth_org_id() and (
      auth_role() = 'admin'
      or exists (
        select 1 from email_contas c
        where c.id = email_enviados.conta_id and auth_role() = any(c.cargos)
      )
    )
  )
);
-- Sem policy de insert: só o email-proxy grava (service role), depois de enviar de verdade.

-- Módulo novo "emails" na Sidebar (src/config/permissions.js) — precisa entrar aqui também,
-- senão o toggle em Configurações falha silenciosamente pra quem não é admin (erro
-- recorrente #1 do projeto, ver CLAUDE.md).
alter table role_permissions drop constraint if exists role_permissions_module_check;
alter table role_permissions add constraint role_permissions_module_check
  check (module in ('hoje','prazos','processos','financeiro','clientes','equipe','executivo','quadro','erp','leads','leads_captacao','emails'));

-- Libera "emails" pro sócio em toda organização já existente (admin já enxerga tudo via
-- has_module). Novas organizações não têm seed de role_permissions nenhum (ver
-- signup-empresa) — cada admin liga o que quiser em Configurações.
insert into role_permissions (org_id, role, module)
select id, 'socio', 'emails' from organizations
on conflict (org_id, role, module) do nothing;

notify pgrst, 'reload schema';
