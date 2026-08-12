-- Escritório Dashboard — schema Supabase (multi-tenant)
-- Como aplicar: copiar este arquivo inteiro e colar no SQL Editor do projeto Supabase, rodar uma vez.

-- ── Tabelas ────────────────────────────────────────────────────────────────

create table organizations (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id),
  nome text not null,
  role text not null check (role in ('socio','advogado','financeiro','recepcao','admin')),
  cargo text,
  horas_mes int not null default 0,
  meta_horas int not null default 160,
  created_at timestamptz not null default now()
);
create index profiles_org_id_idx on profiles (org_id);

create table role_permissions (
  org_id uuid not null references organizations(id),
  role text not null check (role in ('socio','advogado','financeiro','recepcao','admin')),
  module text not null check (module in ('prazos','processos','financeiro','clientes','equipe','executivo')),
  primary key (org_id, role, module)
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  nome text not null,
  tipo text not null check (tipo in ('PF','PJ')),
  origem text,
  contrato_renovacao date,
  created_at timestamptz not null default now()
);
create index clientes_org_id_idx on clientes (org_id);

create table processos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  numero text not null,
  cliente_id uuid not null references clientes(id),
  area text not null,
  status text not null check (status in ('Em andamento','Aguardando decisão','Suspenso','Encerrado')),
  valor numeric(14,2) not null default 0,
  responsavel_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (org_id, numero)
);
create index processos_org_id_idx on processos (org_id);

create table prazos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  processo_id uuid not null references processos(id) on delete cascade,
  tipo text not null,
  data date not null,
  responsavel_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index prazos_org_id_idx on prazos (org_id);

create table honorarios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  cliente_id uuid not null references clientes(id),
  valor numeric(14,2) not null,
  vencimento date not null,
  status text not null check (status in ('Em aberto','Vencido','Pago')) default 'Em aberto',
  created_at timestamptz not null default now()
);
create index honorarios_org_id_idx on honorarios (org_id);

-- Aba "Equipe": deriva de profiles + contagem de processos ativos, sem tabela própria.
-- security_invoker = true é obrigatório aqui — sem isso a view roda com o privilégio de quem
-- criou (o dono do banco) e ignora RLS, vazando dados de outros tenants.
create view equipe_view with (security_invoker = true) as
  select p.id, p.org_id, p.nome, p.cargo, p.horas_mes as horas, p.meta_horas as meta,
         count(pr.id) filter (where pr.status <> 'Encerrado') as ativos
  from profiles p
  left join processos pr on pr.responsavel_id = p.id
  group by p.id;

-- ── Funções helper (fonte única de verdade pra RLS e client) ────────────────

-- security definer + search_path fixo: essas funções leem `profiles` por baixo das
-- policies de RLS. Sem isso, checar profiles_select reaplica a própria policy
-- (que chama auth_org_id(), que lê profiles...) e estoura "stack depth limit exceeded".
create or replace function auth_org_id() returns uuid
  language sql stable security definer set search_path = public
  as $$ select org_id from profiles where id = auth.uid() $$;

create or replace function auth_role() returns text
  language sql stable security definer set search_path = public
  as $$ select role from profiles where id = auth.uid() $$;

create or replace function has_module(module_key text) returns boolean
  language sql stable as $$
    select auth_role() = 'admin' or exists (
      select 1 from role_permissions
      where org_id = auth_org_id() and role = auth_role() and module = module_key)
  $$;

create or replace function set_org_id() returns trigger
  language plpgsql as $$ begin new.org_id := auth_org_id(); return new; end; $$;

-- ── RLS ──────────────────────────────────────────────────────────────────

alter table organizations enable row level security;
create policy org_select on organizations for select using (id = auth_org_id());

alter table profiles enable row level security;
create trigger trg_set_org_id before insert on profiles for each row execute function set_org_id();
create policy profiles_select on profiles for select using (org_id = auth_org_id());
create policy profiles_update on profiles for update
  using (org_id = auth_org_id() and (id = auth.uid() or auth_role() = 'admin'))
  with check (org_id = auth_org_id());
-- insert só o admin — feito pela Edge Function admin-create-user (supabase/functions/),
-- que cria o Auth user com senha temporária (mandada por email) e insere o profile
-- numa tacada, usando a service_role key.
-- Sem policy de delete: remover colaborador é feito apagando o usuário no Auth
-- (Studio → Authentication), o cascade cuida do resto.
create policy profiles_insert on profiles for insert
  with check (auth_role() = 'admin');

alter table role_permissions enable row level security;
create policy role_permissions_select on role_permissions for select using (org_id = auth_org_id());
create policy role_permissions_write on role_permissions for all
  using (org_id = auth_org_id() and auth_role() = 'admin')
  with check (org_id = auth_org_id() and auth_role() = 'admin');

-- Tabelas de negócio: mesmo padrão de 4 policies, module key = chave em MODULES (src/config/permissions.js)

alter table clientes enable row level security;
create trigger trg_set_org_id before insert on clientes for each row execute function set_org_id();
create policy clientes_sel on clientes for select using (org_id = auth_org_id() and has_module('clientes'));
create policy clientes_ins on clientes for insert with check (org_id = auth_org_id() and has_module('clientes'));
create policy clientes_upd on clientes for update using (org_id = auth_org_id() and has_module('clientes')) with check (org_id = auth_org_id());
create policy clientes_del on clientes for delete using (org_id = auth_org_id() and has_module('clientes'));

alter table processos enable row level security;
create trigger trg_set_org_id before insert on processos for each row execute function set_org_id();
create policy processos_sel on processos for select using (org_id = auth_org_id() and has_module('processos'));
create policy processos_ins on processos for insert with check (org_id = auth_org_id() and has_module('processos'));
create policy processos_upd on processos for update using (org_id = auth_org_id() and has_module('processos')) with check (org_id = auth_org_id());
create policy processos_del on processos for delete using (org_id = auth_org_id() and has_module('processos'));

alter table prazos enable row level security;
create trigger trg_set_org_id before insert on prazos for each row execute function set_org_id();
create policy prazos_sel on prazos for select using (org_id = auth_org_id() and has_module('prazos'));
create policy prazos_ins on prazos for insert with check (org_id = auth_org_id() and has_module('prazos'));
create policy prazos_upd on prazos for update using (org_id = auth_org_id() and has_module('prazos')) with check (org_id = auth_org_id());
create policy prazos_del on prazos for delete using (org_id = auth_org_id() and has_module('prazos'));

alter table honorarios enable row level security;
create trigger trg_set_org_id before insert on honorarios for each row execute function set_org_id();
create policy honorarios_sel on honorarios for select using (org_id = auth_org_id() and has_module('financeiro'));
create policy honorarios_ins on honorarios for insert with check (org_id = auth_org_id() and has_module('financeiro'));
create policy honorarios_upd on honorarios for update using (org_id = auth_org_id() and has_module('financeiro')) with check (org_id = auth_org_id());
create policy honorarios_del on honorarios for delete using (org_id = auth_org_id() and has_module('financeiro'));

-- ── Seed: Gimenes & Pires ────────────────────────────────────────────────

insert into organizations (nome, slug) values ('Gimenes & Pires', 'gimenes-pires');

insert into role_permissions (org_id, role, module)
select (select id from organizations where slug = 'gimenes-pires'), role, module
from (values
  ('socio','prazos'),('socio','processos'),('socio','financeiro'),('socio','clientes'),('socio','equipe'),('socio','executivo'),
  ('advogado','prazos'),('advogado','processos'),('advogado','clientes'),
  ('financeiro','financeiro'),('financeiro','clientes'),
  ('recepcao','prazos'),('recepcao','clientes')
) as seed(role, module);

-- Depois de rodar o bloco acima:
-- 1. Authentication → Add user (email + senha temporária) no Studio, copiar o UUID gerado.
-- 2. Rodar (trocando os valores):
--    insert into profiles (id, org_id, nome, role)
--    values ('<uuid-do-usuario>', (select id from organizations where slug = 'gimenes-pires'), 'Seu Nome', 'admin');
