-- Opção de pagar o ano inteiro de uma vez (5% de desconto sobre o valor mensal x12), ao lado
-- da assinatura mensal que já existia. Não mexe na migração anterior (20260915020000, já
-- aplicada em produção) — arquivo novo, mesma mecânica de sempre.
alter table organizations add column if not exists assinatura_ciclo text not null default 'mensal'
  check (assinatura_ciclo in ('mensal', 'anual'));

-- Mesma defesa que as outras colunas de billing já tinham: só platform admin ou service_role
-- (Edge Function de assinatura) mexe nela.
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
  end if;
  return new;
end;
$$;
