-- Lembretes automáticos de cobrança (e-mail 3 dias antes/no dia/3 dias depois do vencimento
-- do honorário). Opt-in por empresa (lembretes_cobranca default false — não manda e-mail pra
-- cliente real sem o escritório ligar). Pix copia-e-cola vem de organizations.pix_chave/
-- pix_nome_recebedor/pix_cidade (colunas de outra migration em paralelo — se ainda não
-- existirem quando você rodar esta, aplique a delas primeiro).
--
-- Antes de aplicar esta migration, grave no Vault o mesmo valor usado pela Edge Function:
--   select vault.create_secret('<valor de COBRANCA_CRON_SECRET>', 'cobranca_cron_secret');

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

alter table organizations add column if not exists lembretes_cobranca boolean not null default false;

-- Dedup: cada (honorario_id, tipo) só é enviado uma vez, mesmo se o cron rodar mais de uma
-- vez no mesmo dia ou reprocessar. Sem org_id direto (deriva de honorarios) — só service role
-- lê/escreve, UI não lista isso ainda.
create table if not exists cobranca_lembretes (
  honorario_id uuid not null references honorarios(id) on delete cascade,
  tipo text not null check (tipo in ('antes', 'dia', 'depois')),
  enviado_em timestamptz not null default now(),
  primary key (honorario_id, tipo)
);
alter table cobranca_lembretes enable row level security;
-- ponytail: sem policy de SELECT pra org — nenhuma tela lista os lembretes enviados ainda.
-- Se/quando a UI precisar mostrar histórico, adicionar policy via join em honorarios
-- (honorario_id in (select id from honorarios where org_id = auth_org_id())).

do $migration$
declare
  segredo_configurado boolean;
begin
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'cobranca_cron_secret' and decrypted_secret is not null and decrypted_secret <> ''
  ) into segredo_configurado;

  if not segredo_configurado then
    raise exception 'Configure o segredo Vault cobranca_cron_secret antes de aplicar esta migration';
  end if;

  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'cobranca-lembretes-diario';

  perform cron.schedule(
    'cobranca-lembretes-diario',
    '0 12 * * *', -- 12:00 UTC = 09:00 Brasília
    $job$
      select net.http_post(
        url := 'https://vclylstjbpsxikmnpguk.supabase.co/functions/v1/cobranca-lembretes',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'cobranca_cron_secret'
          )
        ),
        body := '{}'::jsonb
      );
    $job$
  );
end
$migration$;
