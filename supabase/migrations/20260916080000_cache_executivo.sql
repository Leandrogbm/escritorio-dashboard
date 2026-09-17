-- "Cache" do diagrama de arquitetura, adaptado pro que a Supabase já oferece: materialized
-- view em vez de Redis externo (evita depender de outro serviço/credencial nova). ExecutivoTab
-- hoje baixa TODA linha de processos/honorarios da empresa e soma no navegador a cada abertura
-- de aba — funciona, mas transfere linha demais à toa pra só mostrar um total. As views abaixo
-- pré-somam no banco; o client passa a buscar só o resumo (poucas linhas), não a tabela toda.
--
-- Materialized view NÃO tem RLS própria (Postgres ignora RLS de dentro dela) — por isso cada
-- uma tem uma view "de fachada" com security_invoker, mesmo padrão que equipe_view já usa,
-- filtrando org_id = auth_org_id() de verdade na hora da consulta.

create materialized view mv_exec_processos as
select org_id, area, status, count(*) as qtd, coalesce(sum(valor), 0) as valor_total
from processos
group by org_id, area, status;
create unique index mv_exec_processos_uidx on mv_exec_processos (org_id, area, status);

create view exec_processos_view with (security_invoker = true) as
  select * from mv_exec_processos where org_id = auth_org_id() or is_platform_admin();

create materialized view mv_exec_honorarios as
select h.org_id, to_char(h.vencimento, 'YYYY-MM') as ano_mes, p.area, h.status,
  coalesce(sum(h.valor), 0) as valor_total
from honorarios h
left join processos p on p.id = h.processo_id
group by h.org_id, to_char(h.vencimento, 'YYYY-MM'), p.area, h.status;
create unique index mv_exec_honorarios_uidx on mv_exec_honorarios (org_id, ano_mes, area, status);

create view exec_honorarios_view with (security_invoker = true) as
  select * from mv_exec_honorarios where org_id = auth_org_id() or is_platform_admin();

-- Carga de trabalho por responsável — só processo ativo (mesmo critério que ExecutivoTab.jsx
-- já usava), nome já embutido pra não precisar de outro join no client.
create materialized view mv_exec_carga_responsavel as
select p.org_id, p.responsavel_id, pr.nome as responsavel_nome, count(*) as qtd
from processos p
left join profiles pr on pr.id = p.responsavel_id
where p.status <> 'Encerrado'
group by p.org_id, p.responsavel_id, pr.nome;
create unique index mv_exec_carga_responsavel_uidx on mv_exec_carga_responsavel (org_id, responsavel_id);

create view exec_carga_responsavel_view with (security_invoker = true) as
  select * from mv_exec_carga_responsavel where org_id = auth_org_id() or is_platform_admin();

grant select on exec_processos_view, exec_honorarios_view, exec_carga_responsavel_view to authenticated;

-- Refresh a cada 15min — dashboard não precisa de dado no segundo exato (mesmo motivo de
-- qualquer cache: perde um pouco de frescor, ganha muito menos linha trafegada). CONCURRENTLY
-- não trava leitura enquanto atualiza (precisa do índice único acima pra funcionar).
create or replace function refresh_mv_executivo() returns void
  language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view concurrently mv_exec_processos;
  refresh materialized view concurrently mv_exec_honorarios;
  refresh materialized view concurrently mv_exec_carga_responsavel;
end;
$$;
select cron.schedule('refresh-exec-15min', '*/15 * * * *', $$ select refresh_mv_executivo(); $$);

-- Primeira carga imediata — sem isso as views ficam vazias até o primeiro cron rodar.
select refresh_mv_executivo();
