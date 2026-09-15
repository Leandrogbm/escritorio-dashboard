-- Reconciliação schema.sql x produção: clientes_upd, processos_upd, prazos_upd,
-- honorarios_upd, despesas_upd, leads_upd, leads_captacao_upd, tarefas_upd,
-- depositos_judiciais_upd e role_permissions_write têm "with check (true)" no UPDATE — RLS
-- sozinho não compara valor antigo x novo de uma coluna (WITH CHECK só enxerga a linha
-- nova), então "with check (true)" tecnicamente permitiria mudar org_id pra outro tenant
-- numa única chamada. Teste ao vivo (qa-guardian, 2026-09) mostrou que isso já vem
-- bloqueado em produção — mecanismo exato não documentado, schema.sql estava desatualizado
-- em relação ao banco real. Este trigger fecha isso de forma explícita e auditável, mesmo
-- padrão de guard_profiles_role: nunca deixa org_id mudar por UPDATE via client, pra
-- qualquer role, sempre — mover um registro de tenant nunca é uma operação de UPDATE comum,
-- se um dia for necessária de verdade é function/Edge Function dedicada, service_role.
create or replace function guard_org_id_immutable() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  new.org_id := old.org_id;
  return new;
end;
$$;

create trigger trg_guard_org_id before update on clientes
  for each row execute function guard_org_id_immutable();
create trigger trg_guard_org_id before update on processos
  for each row execute function guard_org_id_immutable();
create trigger trg_guard_org_id before update on prazos
  for each row execute function guard_org_id_immutable();
create trigger trg_guard_org_id before update on honorarios
  for each row execute function guard_org_id_immutable();
create trigger trg_guard_org_id before update on despesas
  for each row execute function guard_org_id_immutable();
create trigger trg_guard_org_id before update on leads
  for each row execute function guard_org_id_immutable();
create trigger trg_guard_org_id before update on leads_captacao
  for each row execute function guard_org_id_immutable();
create trigger trg_guard_org_id before update on tarefas
  for each row execute function guard_org_id_immutable();
create trigger trg_guard_org_id before update on depositos_judiciais
  for each row execute function guard_org_id_immutable();
create trigger trg_guard_org_id before update on role_permissions
  for each row execute function guard_org_id_immutable();
