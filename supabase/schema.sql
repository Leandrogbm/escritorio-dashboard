-- Escritório Dashboard — schema Supabase (multi-tenant)
-- Como aplicar: copiar este arquivo inteiro e colar no SQL Editor do projeto Supabase, rodar uma vez.
--
-- Configuração fora do SQL (Authentication → Settings no dashboard, ou API de management):
--   disable_signup = true — o self-signup público (POST /auth/v1/signup) fica desligado.
--   Cadastro de empresa só entra pela Edge Function signup-empresa (admin.createUser, service_role).
--   Sem isso, qualquer um podia criar uma conta órfã direto pela API só com a anon key.

-- ── Tabelas ────────────────────────────────────────────────────────────────

create table organizations (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique not null,
  cnpj text unique, -- cadastro self-service (signup-empresa) usa os dígitos do CNPJ como slug
  -- billing que a empresa paga PRA plataforma (mysaldo) — não confundir com honorarios,
  -- que é o financeiro interno dela. Só o platform admin edita (organizations_billing_upd).
  plano text,
  valor_mensal numeric(10,2),
  status_pagamento text check (status_pagamento in ('pago','pendente','atrasado')) not null default 'pendente',
  suspenso boolean not null default false, -- bloqueia login de toda a empresa (App.jsx), sem apagar nada
  created_at timestamptz not null default now(),
  -- perfil da própria empresa (aba "Minha Empresa") — editável por admin/sócio,
  -- ver organizations_self_upd + trg_guard_organizations_protected_cols.
  logo_url text,
  -- enquadramento da logo exibida (Sidebar, Minha Empresa): zoom + posição em %,
  -- só ajusta a exibição (object-position/transform no client), não recorta o arquivo.
  logo_zoom numeric not null default 1,
  logo_pos_x numeric not null default 50,
  logo_pos_y numeric not null default 50,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text
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
  documento text, -- CPF (PF) ou CNPJ (PJ), sem validação de dígito verificador de propósito
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

-- Os 3 planos e seus limites — fonte única de verdade (Edge Function admin-create-user e
-- a policy processos_ins leem daqui). limite_usuarios/limite_processos null = sem limite.
create table plan_limits (
  plano text primary key,
  valor_mensal numeric(10,2) not null,
  limite_usuarios int,
  limite_processos int
);
insert into plan_limits (plano, valor_mensal, limite_usuarios, limite_processos) values
  ('basic', 100.00, 5, 50),
  ('intermediario', 300.00, 15, 200),
  ('plus', 500.00, null, null);
alter table plan_limits enable row level security;
-- todo mundo autenticado lê (é a lista de preços, não é segredo)
create policy plan_limits_select on plan_limits for select using (true);
grant select on plan_limits to authenticated;
alter table organizations add constraint organizations_plano_fkey foreign key (plano) references plan_limits(plano);

-- Aba "Equipe": deriva de profiles + contagem de processos ativos, sem tabela própria.
-- security_invoker = true é obrigatório aqui — sem isso a view roda com o privilégio de quem
-- criou (o dono do banco) e ignora RLS, vazando dados de outros tenants.
-- Admin também aparece na lista (pedido do usuário) — role vem junto pra UI montar o
-- dropdown de cargo. p.role tem que ficar no fim do SELECT: CREATE OR REPLACE VIEW não
-- deixa reordenar/renomear colunas existentes, só apendar.
create view equipe_view with (security_invoker = true) as
  select p.id, p.org_id, p.nome, p.cargo, p.horas_mes as horas, p.meta_horas as meta,
         count(pr.id) filter (where pr.status <> 'Encerrado') as ativos, p.role
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

-- ── Admin da plataforma (dono do mysaldo) ───────────────────────────────
-- Separado do admin de cada empresa. Duas coisas: (1) painel de billing — plano/valor/
-- status que cada empresa paga PRA plataforma, nada a ver com o financeiro interno dela
-- (honorarios); (2) acesso de SUPORTE somente-leitura a qualquer empresa (correção de bug/
-- reclamação) — por isso "or is_platform_admin()" aparece só nas policies de SELECT abaixo,
-- nunca em insert/update/delete: corrigir de verdade é código/banco, não editar pela UI
-- da empresa. Definido antes da seção de RLS porque as policies logo abaixo já usam.

create table platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table platform_admins enable row level security;
-- só o próprio platform admin lê essa tabela (pra saber que é um) — sem policy de insert,
-- entra só via SQL/Studio direto, é bootstrap raro.
create policy platform_admins_select on platform_admins for select using (user_id = auth.uid());

create or replace function is_platform_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from platform_admins where user_id = auth.uid()) $$;

-- ── RLS ──────────────────────────────────────────────────────────────────

alter table organizations enable row level security;
create policy org_select on organizations for select using (id = auth_org_id() or is_platform_admin());
-- sem policy de insert de propósito: criar organization só acontece na Edge Function
-- signup-empresa, com service_role (ignora RLS) — um visitante sem org ainda não tem
-- como passar em auth_org_id() pra se auto-inserir de qualquer forma.
-- update só pra billing (plano/valor_mensal/status_pagamento), e só o platform admin —
-- não faz sentido a própria empresa mexer no que ela paga pra plataforma.
create policy organizations_billing_upd on organizations for update
  using (is_platform_admin()) with check (is_platform_admin());

-- Além do billing, admin/sócio da própria empresa pode editar nome/logo/endereço
-- (aba "Minha Empresa"). O trigger abaixo é a defesa de verdade contra mexer no
-- billing/cnpj por essa via — não dá pra confiar só em esconder campo na UI.
create policy organizations_self_upd on organizations for update
  using (id = auth_org_id() and auth_role() in ('admin','socio'))
  with check (id = auth_org_id());

create or replace function guard_organizations_protected_cols() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_admin() then
    new.plano := old.plano;
    new.valor_mensal := old.valor_mensal;
    new.status_pagamento := old.status_pagamento;
    new.suspenso := old.suspenso;
    -- cnpj saiu da lista de protegidos: admin/sócio edita pela aba Minha Empresa.
  end if;
  return new;
end;
$$;
create trigger trg_guard_organizations_protected_cols before update on organizations
  for each row execute function guard_organizations_protected_cols();

-- Bucket de logos das empresas — path é "<org_id>/logo.<ext>", RLS por pasta.
insert into storage.buckets (id, name, public) values ('org-logos', 'org-logos', true)
  on conflict (id) do nothing;
create policy org_logos_insert on storage.objects for insert
  with check (bucket_id = 'org-logos' and (storage.foldername(name))[1] = auth_org_id()::text and auth_role() in ('admin','socio'));
create policy org_logos_update on storage.objects for update
  using (bucket_id = 'org-logos' and (storage.foldername(name))[1] = auth_org_id()::text and auth_role() in ('admin','socio'));
create policy org_logos_delete on storage.objects for delete
  using (bucket_id = 'org-logos' and (storage.foldername(name))[1] = auth_org_id()::text and auth_role() in ('admin','socio'));

alter table profiles enable row level security;
-- SEM trg_set_org_id aqui de propósito (diferente de clientes/processos/prazos/honorarios):
-- profiles só é inserido pelas Edge Functions (service_role, sem sessão de usuário), que já
-- passam o org_id certo explicitamente. Um trigger "auth_org_id() sobrescreve sempre" quebraria
-- esse insert, porque auth_org_id() resolve null sem sessão — já aconteceu, foi revertido.
create policy profiles_select on profiles for select using (org_id = auth_org_id() or is_platform_admin());
-- sócio edita qualquer colega, menos o admin (role <> 'admin' olha a linha ANTES do update —
-- sócio não consegue nem tocar num profile que já é admin, promover ninguém a admin também
-- não rola por aqui: a lista de cargo na UI já nem mostra a opção pra quem não é admin).
create policy profiles_update on profiles for update
  using (org_id = auth_org_id() and (id = auth.uid() or auth_role() = 'admin' or (auth_role() = 'socio' and role <> 'admin')))
  with check (org_id = auth_org_id());
-- insert só o admin — feito pela Edge Function admin-create-user (supabase/functions/),
-- que cria o Auth user com senha temporária (mandada por email) e insere o profile
-- numa tacada, usando a service_role key.
-- Sem policy de delete: remover colaborador é feito apagando o usuário no Auth, via a
-- Edge Function admin-delete-user (admin/sócio da própria org, OU o platform admin
-- mirando qualquer empresa) — o cascade cuida do profile sozinho.
-- org_id = auth_org_id() aqui é essencial, não só auth_role() = 'admin' — sem isso, um
-- admin de QUALQUER empresa poderia inserir um profile com org_id de outra (plantando um
-- admin lá) direto via API, sem passar pela Edge Function. Como não tem trigger aqui (ver
-- acima), esse check explícito é a ÚNICA proteção, não é só defesa em profundidade.
create policy profiles_insert on profiles for insert
  with check (auth_role() = 'admin' and org_id = auth_org_id());

alter table role_permissions enable row level security;
create policy role_permissions_select on role_permissions for select using (org_id = auth_org_id());
-- sócio também mexe em Configurações, não só admin (pedido do usuário).
create policy role_permissions_write on role_permissions for all
  using (org_id = auth_org_id() and auth_role() in ('admin','socio'))
  with check (org_id = auth_org_id() and auth_role() in ('admin','socio'));

-- Tabelas de negócio: mesmo padrão de 4 policies, module key = chave em MODULES (src/config/permissions.js)

alter table clientes enable row level security;
create trigger trg_set_org_id before insert on clientes for each row execute function set_org_id();
create policy clientes_sel on clientes for select using ((org_id = auth_org_id() and has_module('clientes')) or is_platform_admin());
create policy clientes_ins on clientes for insert with check (org_id = auth_org_id() and has_module('clientes'));
create policy clientes_upd on clientes for update using (org_id = auth_org_id() and has_module('clientes')) with check (org_id = auth_org_id());
-- só admin/sócio excluem cliente (diferente das outras policies, que valem pra quem tem o
-- módulo) — ou o platform admin, mirando qualquer empresa (pedido explícito do dono).
create policy clientes_del on clientes for delete using (
  (org_id = auth_org_id() and has_module('clientes') and auth_role() in ('admin','socio')) or is_platform_admin()
);

alter table processos enable row level security;
create trigger trg_set_org_id before insert on processos for each row execute function set_org_id();
-- advogado só vê/edita/exclui processos onde é o responsável designado (pelo sócio/admin,
-- via o campo "Responsável" do form) — sócio/admin/financeiro/recepção continuam vendo
-- todos os processos da org (só precisam do módulo liberado em role_permissions).
create policy processos_sel on processos for select using (
  (org_id = auth_org_id() and has_module('processos') and (auth_role() <> 'advogado' or responsavel_id = auth.uid()))
  or is_platform_admin()
);
-- limite de processos do plano entra aqui — org sem plano (plano null) fica sem limite.
create policy processos_ins on processos for insert with check (
  org_id = auth_org_id() and has_module('processos') and (
    (select limite_processos from plan_limits pl join organizations o on o.plano = pl.plano where o.id = auth_org_id()) is null
    or (select count(*) from processos p2 where p2.org_id = auth_org_id())
       < (select limite_processos from plan_limits pl join organizations o on o.plano = pl.plano where o.id = auth_org_id())
  )
);
create policy processos_upd on processos for update
  using (org_id = auth_org_id() and has_module('processos') and (auth_role() <> 'advogado' or responsavel_id = auth.uid()))
  with check (org_id = auth_org_id());
create policy processos_del on processos for delete using (
  org_id = auth_org_id() and has_module('processos') and (auth_role() <> 'advogado' or responsavel_id = auth.uid())
);

alter table prazos enable row level security;
create trigger trg_set_org_id before insert on prazos for each row execute function set_org_id();
create policy prazos_sel on prazos for select using ((org_id = auth_org_id() and has_module('prazos')) or is_platform_admin());
create policy prazos_ins on prazos for insert with check (org_id = auth_org_id() and has_module('prazos'));
create policy prazos_upd on prazos for update using (org_id = auth_org_id() and has_module('prazos')) with check (org_id = auth_org_id());
create policy prazos_del on prazos for delete using (org_id = auth_org_id() and has_module('prazos'));

alter table honorarios enable row level security;
create trigger trg_set_org_id before insert on honorarios for each row execute function set_org_id();
create policy honorarios_sel on honorarios for select using ((org_id = auth_org_id() and has_module('financeiro')) or is_platform_admin());
create policy honorarios_ins on honorarios for insert with check (org_id = auth_org_id() and has_module('financeiro'));
create policy honorarios_upd on honorarios for update using (org_id = auth_org_id() and has_module('financeiro')) with check (org_id = auth_org_id());
create policy honorarios_del on honorarios for delete using (org_id = auth_org_id() and has_module('financeiro'));

-- security definer: ignora RLS de propósito, é o único jeito de agregar contagem
-- cross-tenant. Só devolve algo se quem chama for platform admin; senão, vazio.
create or replace function platform_org_metrics()
returns table (
  org_id uuid, nome text, cnpj text, created_at timestamptz,
  colaboradores bigint, clientes bigint, processos bigint,
  plano text, valor_mensal numeric, status_pagamento text, suspenso boolean
)
language sql stable security definer set search_path = public
as $$
  select o.id, o.nome, o.cnpj, o.created_at,
    (select count(*) from profiles p where p.org_id = o.id) as colaboradores,
    (select count(*) from clientes c where c.org_id = o.id) as clientes,
    (select count(*) from processos pr where pr.org_id = o.id) as processos,
    o.plano, o.valor_mensal, o.status_pagamento, o.suspenso
  from organizations o
  where is_platform_admin()
  order by o.created_at desc
$$;

grant execute on function is_platform_admin() to authenticated;
grant execute on function platform_org_metrics() to authenticated;

-- Excluir empresa por completo (colaboradores, clientes, processos, financeiro, a org em si)
-- é a Edge Function platform-delete-org — precisa apagar cada Auth user via Admin API,
-- então não dá pra fazer só com RLS/policy; fica de fora do SQL puro.

-- primeiro platform admin — trocar pelo UUID do seu próprio usuário (Studio → Authentication)
insert into platform_admins (user_id) values ('<uuid-do-dono-da-plataforma>');

-- ── Integração DataJud (CNJ) — andamentos processuais e prazos ─────────────
-- Edge Function datajud-sync consulta a API pública do DataJud (1x/dia via cron, ou sob
-- demanda pelo botão "Sincronizar" em ProcessosTab), grava andamento novo em
-- movimentacoes_processo e gera notificacoes. O DataJud não traz o prazo pronto — só avisa
-- que o processo teve andamento — por isso o cálculo de prazo é uma camada própria,
-- acionada manualmente pelo advogado a partir de uma movimentação "requer atenção".

alter table processos add column if not exists tribunal_alias text; -- ex: 'tjsp', extraído do número CNJ
alter table processos add column if not exists ultima_verificacao_datajud timestamptz;
alter table processos add column if not exists datajud_status text check (datajud_status in ('ok','erro','nao_suportado'));
alter table processos add column if not exists datajud_erro text;

create table movimentacoes_processo (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  processo_id uuid not null references processos(id) on delete cascade,
  nome text not null,
  data_hora timestamptz not null,
  complemento jsonb,
  requer_atencao boolean not null default false,
  dedup_key text not null, -- hash(nome+data_hora) — evita duplicar o mesmo andamento a cada sync
  created_at timestamptz not null default now(),
  unique (processo_id, dedup_key)
);
create index movimentacoes_processo_org_id_idx on movimentacoes_processo (org_id);
create index movimentacoes_processo_processo_id_idx on movimentacoes_processo (processo_id);

create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  processo_id uuid references processos(id) on delete cascade,
  movimentacao_id uuid references movimentacoes_processo(id) on delete cascade,
  prazo_id uuid references prazos(id) on delete cascade,
  tipo text not null check (tipo in ('movimentacao','prazo')) default 'movimentacao',
  titulo text not null,
  texto text,
  requer_atencao boolean not null default false,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);
create index notificacoes_org_id_idx on notificacoes (org_id);
create index notificacoes_lida_idx on notificacoes (org_id, lida);

-- Termos que marcam uma movimentação como "requer atenção" (intimação/prazo/etc.) —
-- configurável, não fixo no código. Global (vocabulário jurídico comum, não específico de
-- uma firma): qualquer autenticado lê; só admin edita.
create table termos_atencao (termo text primary key);
alter table termos_atencao enable row level security;
create policy termos_atencao_select on termos_atencao for select using (true);
create policy termos_atencao_write on termos_atencao for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');
grant select on termos_atencao to authenticated;

insert into termos_atencao (termo) values
  ('intimação'), ('intimacao'), ('publicação'), ('publicacao'), ('decisão'), ('decisao'),
  ('sentença'), ('sentenca'), ('despacho'), ('prazo'), ('citação'), ('citacao'),
  ('audiência'), ('audiencia'), ('recurso'), ('embargos'), ('acórdão'), ('acordao')
on conflict (termo) do nothing;

alter table movimentacoes_processo enable row level security;
create policy movimentacoes_sel on movimentacoes_processo for select using
  ((org_id = auth_org_id() and has_module('processos')) or is_platform_admin());
-- sem policy de insert/update: só a Edge Function datajud-sync (service_role) escreve aqui —
-- ninguém edita andamento processual na mão, ele vem da fonte oficial.

alter table notificacoes enable row level security;
create policy notificacoes_sel on notificacoes for select using (org_id = auth_org_id());
create policy notificacoes_upd on notificacoes for update
  using (org_id = auth_org_id()) with check (org_id = auth_org_id()); -- só marcar como lida

-- Feriados nacionais (fixos + móveis via algoritmo de Páscoa) pro cálculo de prazo em dias
-- úteis. Feriado forense local (estadual/municipal) fica de fora por decisão consciente —
-- sem fonte confiável validada, prefiro contar dia útil a mais do que inventar feriado errado.
create table feriados_nacionais (data date primary key, nome text not null);
alter table feriados_nacionais enable row level security;
create policy feriados_nacionais_select on feriados_nacionais for select using (true);
grant select on feriados_nacionais to authenticated;

create or replace function pascoa(ano int) returns date
  language plpgsql immutable set search_path = public as $$
declare
  a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int; mes int; dia int;
begin
  a := ano % 19; b := ano / 100; c := ano % 100; d := b / 4; e := b % 4;
  f := (b + 8) / 25; g := (b - f + 1) / 3; h := (19*a + b - d - g + 15) % 30;
  i := c / 4; k := c % 4; l := (32 + 2*e + 2*i - h - k) % 7; m := (a + 11*h + 22*l) / 451;
  mes := (h + l - 7*m + 114) / 31; dia := ((h + l - 7*m + 114) % 31) + 1;
  return make_date(ano, mes, dia);
end;
$$;

create or replace function seed_feriados_nacionais(ano int) returns void
  language plpgsql set search_path = public as $$
declare p date := pascoa(ano);
begin
  insert into feriados_nacionais (data, nome) values
    (make_date(ano,1,1), 'Confraternização Universal'),
    (p - 47, 'Carnaval (segunda)'), (p - 46, 'Carnaval (terça)'),
    (p - 2, 'Sexta-feira Santa'), (p + 60, 'Corpus Christi'),
    (make_date(ano,4,21), 'Tiradentes'), (make_date(ano,5,1), 'Dia do Trabalho'),
    (make_date(ano,9,7), 'Independência do Brasil'), (make_date(ano,10,12), 'Nossa Senhora Aparecida'),
    (make_date(ano,11,2), 'Finados'), (make_date(ano,11,15), 'Proclamação da República'),
    (make_date(ano,11,20), 'Consciência Negra'), (make_date(ano,12,25), 'Natal')
  on conflict (data) do nothing;
end;
$$;

do $$ begin for ano in 2024..2029 loop perform seed_feriados_nacionais(ano); end loop; end; $$;
-- rodar seed_feriados_nacionais(ano) de novo quando os anos acabarem (2030+)

-- Conta dias úteis pra frente a partir de data_inicio — pula sábado/domingo/feriado nacional.
create or replace function calcula_prazo_util(data_inicio date, dias int) returns date
  language plpgsql immutable set search_path = public as $$
declare d date := data_inicio; restantes int := dias;
begin
  while restantes > 0 loop
    d := d + 1;
    if extract(dow from d) not in (0,6) and not exists (select 1 from feriados_nacionais where data = d) then
      restantes := restantes - 1;
    end if;
  end loop;
  return d;
end;
$$;

create or replace function calcula_prazo(data_inicio date, dias int, uteis boolean) returns date
  language sql immutable set search_path = public as $$
  select case when uteis then calcula_prazo_util(data_inicio, dias) else data_inicio + dias end
$$;

-- Extensão de prazos: guarda a origem do cálculo (início + quantidade) além da data final,
-- pra reexibir/auditar como chegou nela; "data" continua a fonte de verdade pra exibição.
alter table prazos add column if not exists data_inicio date;
alter table prazos add column if not exists dias_uteis boolean not null default true;
alter table prazos add column if not exists quantidade_dias int;
alter table prazos add column if not exists alerta_dias_antes int not null default 3;
alter table prazos add column if not exists alerta_gerado boolean not null default false; -- evita notificar 2x
alter table prazos add column if not exists movimentacao_origem_id uuid references movimentacoes_processo(id);

-- Se data_inicio/quantidade_dias vierem preenchidos, "data" é sempre recalculada a partir
-- deles — evita UI e banco divergirem sobre qual é a data real do prazo.
create or replace function set_prazo_data() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.data_inicio is not null and new.quantidade_dias is not null then
    new.data := calcula_prazo(new.data_inicio, new.quantidade_dias, new.dias_uteis);
  end if;
  return new;
end;
$$;
create trigger trg_set_prazo_data before insert or update on prazos
  for each row execute function set_prazo_data();

-- Gera notificação quando faltam <= alerta_dias_antes dias úteis pro vencimento (ou já
-- venceu) e ainda não foi alertado. Agendada 1x/dia via cron abaixo.
create or replace function gerar_alertas_prazos() returns void
  language plpgsql set search_path = public as $$
declare r record;
begin
  for r in
    select p.*, pr.numero as processo_numero
    from prazos p join processos pr on pr.id = p.processo_id
    where p.alerta_gerado = false and p.data is not null
      and calcula_prazo_util(current_date, p.alerta_dias_antes) >= p.data
  loop
    insert into notificacoes (org_id, processo_id, prazo_id, tipo, titulo, texto, requer_atencao)
    values (
      r.org_id, r.processo_id, r.id, 'prazo',
      case when r.data < current_date then format('Prazo VENCIDO — processo %s', r.processo_numero)
        else format('Prazo vence em breve — processo %s', r.processo_numero) end,
      format('%s — vencimento %s', r.tipo, to_char(r.data, 'DD/MM/YYYY')),
      true
    );
    update prazos set alerta_gerado = true where id = r.id;
  end loop;
end;
$$;

-- Agendamento (precisa de pg_cron + pg_net habilitados, e o segredo salvo no Vault:
-- select vault.create_secret('<valor-aleatorio-seu>', 'datajud_cron_secret', '...');
-- — o mesmo valor vai como secret DATAJUD_CRON_SECRET da Edge Function datajud-sync).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('datajud-sync-diario', '0 9 * * *', $$
  select net.http_post(
    url := 'https://vclylstjbpsxikmnpguk.supabase.co/functions/v1/datajud-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'datajud_cron_secret')
    ),
    body := '{}'::jsonb
  );
$$);
select cron.schedule('prazos-alertas-diario', '0 8 * * *', $$ select gerar_alertas_prazos(); $$);

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
