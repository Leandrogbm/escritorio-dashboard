-- Trava contra carding: achado real do qa-guardian (10/10 chamadas de teste passaram sem
-- nenhum bloqueio contra a API real do Mercado Pago). Contador de tentativas de pagamento
-- falhas seguidas por org + bloqueio temporário ao bater o limite — ver
-- supabase/functions/_shared/limitePagamento.ts, usado pelas 3 functions que cobram.
alter table organizations add column if not exists tentativas_pagamento_falhas int not null default 0;
alter table organizations add column if not exists bloqueado_pagamento_ate timestamptz;

-- Mesma defesa que as outras colunas de billing já tinham: só platform admin ou service_role
-- (as próprias Edge Functions de pagamento) mexe nelas.
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
    new.tentativas_pagamento_falhas := old.tentativas_pagamento_falhas;
    new.bloqueado_pagamento_ate := old.bloqueado_pagamento_ate;
  end if;
  return new;
end;
$$;
