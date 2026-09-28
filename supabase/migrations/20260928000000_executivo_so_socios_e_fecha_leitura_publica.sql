-- Painel Executivo (ExecutivoTab / Visão geral do ERP), duas correções:
--
-- 1) Processo confidencial restrito a advogado(s) específico(s) (confidencial = true e
--    responsavel_socios = false) não entra nos totais — o painel mostra só o que os sócios
--    enxergam. Honorário ligado a esse processo sai junto (mesma regra de honorarios_sel).
--
-- 2) Vazamento: as materialized views ficavam legíveis direto pela API pública (anon), com
--    dado de todas as empresas. Agora ninguém lê mv_* direto; as views de fachada rodam com
--    permissão do dono (security_invoker = false) e filtram pela empresa de quem chama.

drop materialized view if exists mv_exec_processos cascade;
drop materialized view if exists mv_exec_honorarios cascade;
drop materialized view if exists mv_exec_carga_responsavel cascade;

create materialized view mv_exec_processos as
select org_id, area, status, count(*) as qtd, coalesce(sum(valor), 0) as valor_total
from processos
where not (confidencial and not responsavel_socios)
group by org_id, area, status;
create unique index mv_exec_processos_uidx on mv_exec_processos (org_id, area, status);

create materialized view mv_exec_honorarios as
select h.org_id, to_char(h.vencimento, 'YYYY-MM') as ano_mes, p.area, h.status,
  coalesce(sum(h.valor), 0) as valor_total
from honorarios h
left join processos p on p.id = h.processo_id
where p.id is null or not (p.confidencial and not p.responsavel_socios)
group by h.org_id, to_char(h.vencimento, 'YYYY-MM'), p.area, h.status;
create unique index mv_exec_honorarios_uidx on mv_exec_honorarios (org_id, ano_mes, area, status);

create materialized view mv_exec_carga_responsavel as
select p.org_id, p.responsavel_id, pr.nome as responsavel_nome, count(*) as qtd
from processos p
left join profiles pr on pr.id = p.responsavel_id
where p.status <> 'Encerrado' and not (p.confidencial and not p.responsavel_socios)
group by p.org_id, p.responsavel_id, pr.nome;
create unique index mv_exec_carga_responsavel_uidx on mv_exec_carga_responsavel (org_id, responsavel_id);

revoke all on mv_exec_processos, mv_exec_honorarios, mv_exec_carga_responsavel from anon, authenticated;

create view exec_processos_view with (security_invoker = false) as
  select * from mv_exec_processos where org_id = auth_org_id() or is_platform_admin();
create view exec_honorarios_view with (security_invoker = false) as
  select * from mv_exec_honorarios where org_id = auth_org_id() or is_platform_admin();
create view exec_carga_responsavel_view with (security_invoker = false) as
  select * from mv_exec_carga_responsavel where org_id = auth_org_id() or is_platform_admin();

revoke all on exec_processos_view, exec_honorarios_view, exec_carga_responsavel_view from anon;
grant select on exec_processos_view, exec_honorarios_view, exec_carga_responsavel_view to authenticated;

-- refresh_mv_executivo() e o cron refresh-exec-15min continuam valendo (mesmos nomes).
select refresh_mv_executivo();
