-- PIX pré-pago por período (3/6/12 meses), trilho separado da assinatura recorrente de
-- cartão que já existe (20260915020000/20260915030000, não mexidas aqui). PIX não tem token
-- salvo pra cobrar de novo sozinho — é sempre pagamento único; pix_valido_ate guarda até
-- quando o período pago continua liberando acesso.
alter table organizations add column if not exists pix_valido_ate timestamptz;

-- Mesma defesa que as outras colunas de billing já tinham: só platform admin ou service_role
-- (Edge Function de PIX/webhook) mexe nela.
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
    new.pix_valido_ate := old.pix_valido_ate;
  end if;
  return new;
end;
$$;

-- Reaproveita o cron diário que já existe (efetivar_cancelamentos_agendados, migração
-- 20260915020000) — acrescenta a checagem de período PIX vencido. Diferente do cancelamento
-- de cartão (que desce pro plano GRÁTIS), PIX vencido sem assinatura de cartão ativa vira
-- 'atrasado': bloqueia a plataforma inteira (gate em App.jsx já cobre org com plano pago e
-- status_pagamento != 'pago' — sem UI nova), porque era um plano pago que só não foi renovado,
-- não é o trial. Se a org tiver assinatura de cartão ativa (mercado_pago_subscription_id não
-- nulo), o PIX vencido não faz nada — quem manda é a assinatura recorrente.
create or replace function efetivar_cancelamentos_agendados() returns void
  language plpgsql security definer set search_path = public as $$
begin
  update organizations
  set plano = 'gratis', valor_mensal = 0, status_pagamento = 'pago',
      mercado_pago_subscription_id = null, assinatura_iniciada_em = null, cancelamento_agendado_para = null
  where cancelamento_agendado_para is not null and cancelamento_agendado_para <= now();

  update organizations
  set status_pagamento = 'atrasado'
  where pix_valido_ate is not null and pix_valido_ate <= now()
    and mercado_pago_subscription_id is null
    and status_pagamento = 'pago';
end;
$$;
