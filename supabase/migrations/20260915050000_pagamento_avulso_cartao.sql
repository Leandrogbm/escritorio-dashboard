-- Cartão também ganha pagamento único pré-pago (3/6/12 meses, mesmos descontos 3%/4%/5% que
-- o PIX já usava), ao lado da assinatura recorrente (Preapproval) que continua existindo.
-- Regra central: pagamento pré-pago (cartão OU PIX) NUNCA é cancelável — já foi cobrado o
-- valor total, sem como devolver parcial. Como nenhum dos dois seta
-- mercado_pago_subscription_id, "não cancelável" já é automático: mercado-pago-cancelar-
-- assinatura só mexe em quem tem essa coluna preenchida (assinatura recorrente de verdade).
--
-- pix_valido_ate virava um conceito genérico assim que cartão pré-pago passou a usar a MESMA
-- coisa ("acesso pago até tal data, sem renovação automática") — renomeia em vez de duplicar
-- coluna/cron. Não mexe nas migrações já aplicadas (20260915020000/030000/040000), só
-- continua de onde a 040000 parou.
alter table organizations rename column pix_valido_ate to acesso_pago_ate;

-- Mesma defesa que as outras colunas de billing já tinham: só platform admin ou service_role
-- (Edge Function de pagamento/webhook) mexe nela.
create or replace function guard_organizations_protected_cols() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_admin() and auth.role() <> 'service_role' then
    new.plano := old.plano;
    new.valor_mensal := old.valor_mensal;
    new.mercado_pago_checkout_url := old.mercado_pago_checkout_url;
    new.status_pagamento := old.status_pagamento;
    new.suspenso := old.suspenso;
    new.mercado_pago_subscription_id := old.mercado_pago_subscription_id;
    new.assinatura_iniciada_em := old.assinatura_iniciada_em;
    new.cancelamento_agendado_para := old.cancelamento_agendado_para;
    new.assinatura_ciclo := old.assinatura_ciclo;
    new.acesso_pago_ate := old.acesso_pago_ate;
  end if;
  return new;
end;
$$;

-- Só troca o nome da coluna que o cron lê — mesma lógica de antes (vencido + sem assinatura
-- de cartão ativa -> 'atrasado'), agora cobrindo os dois pré-pagos (PIX e cartão) por igual.
create or replace function efetivar_cancelamentos_agendados() returns void
  language plpgsql security definer set search_path = public as $$
begin
  update organizations
  set plano = 'gratis', valor_mensal = 0, status_pagamento = 'pago',
      mercado_pago_subscription_id = null, assinatura_iniciada_em = null, cancelamento_agendado_para = null
  where cancelamento_agendado_para is not null and cancelamento_agendado_para <= now();

  update organizations
  set status_pagamento = 'atrasado'
  where acesso_pago_ate is not null and acesso_pago_ate <= now()
    and mercado_pago_subscription_id is null
    and status_pagamento = 'pago';
end;
$$;
