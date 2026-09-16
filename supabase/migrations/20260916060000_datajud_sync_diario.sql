-- Sincroniza todos os processos ativos uma vez por dia às 06:00 no horário de Brasília.
-- O pg_cron usa UTC: 09:00 UTC corresponde a 06:00 BRT.
--
-- Antes de aplicar esta migration, grave no Vault o mesmo valor usado pela Edge Function:
--   select vault.create_secret('<valor de DATAJUD_CRON_SECRET>', 'datajud_cron_secret');
-- O segredo nunca fica no código nem no histórico do Git.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $migration$
declare
  segredo_configurado boolean;
begin
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'datajud_cron_secret' and decrypted_secret is not null and decrypted_secret <> ''
  ) into segredo_configurado;

  if not segredo_configurado then
    raise exception 'Configure o segredo Vault datajud_cron_secret antes de aplicar esta migration';
  end if;

  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'datajud-sync-diario';

  perform cron.schedule(
    'datajud-sync-diario',
    '0 9 * * *',
    $job$
      select net.http_post(
        url := 'https://vclylstjbpsxikmnpguk.supabase.co/functions/v1/datajud-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'datajud_cron_secret'
          )
        ),
        body := '{}'::jsonb
      );
    $job$
  );
end
$migration$;