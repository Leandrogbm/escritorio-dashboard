-- Checkout individual e idempotência do webhook do Mercado Pago.
alter table organizations add column if not exists mercado_pago_checkout_url text;
alter table platform_cobrancas add column if not exists mercado_pago_payment_id text unique;

-- A empresa não pode trocar o próprio checkout por um link externo.
create or replace function guard_organizations_protected_cols() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_admin() and auth.role() <> 'service_role' then
    new.plano := old.plano;
    new.valor_mensal := old.valor_mensal;
    new.mercado_pago_checkout_url := old.mercado_pago_checkout_url;
    new.status_pagamento := old.status_pagamento;
    new.suspenso := old.suspenso;
  end if;
  return new;
end;
$$;
