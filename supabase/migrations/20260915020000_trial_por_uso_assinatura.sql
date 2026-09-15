-- Motor de cobrança v2: trial por uso (2 clientes/processos/usuários grátis, sem prazo) +
-- assinatura recorrente via Mercado Pago Payment Brick (embutido, sem redirecionar pro
-- checkout do Mercado Pago) + fidelidade mínima de 3 meses. Substitui o checkout avulso de
-- signup-empresa (preferência + 6 platform_cobrancas de uma vez).

-- Plano grátis: mesmo mecanismo de limite que já existe (RLS clientes_ins/processos_ins,
-- Edge Function admin-create-user já leem plan_limits) — só precisa da linha.
insert into plan_limits (plano, valor_mensal, limite_usuarios, limite_processos, limite_clientes)
values ('gratis', 0.00, 2, 2, 2)
on conflict (plano) do nothing;

alter table organizations add column if not exists mercado_pago_subscription_id text;
alter table organizations add column if not exists assinatura_iniciada_em timestamptz;
-- Cancelamento pedido DEPOIS da fidelidade de 3 meses não desfaz o ciclo já pago: a chamada
-- ao Mercado Pago (PUT status=cancelled, pra parar de cobrar de novo) acontece na hora, mas
-- o downgrade pro plano grátis só é EFETIVADO no fim do ciclo corrente (ver
-- efetivar_cancelamentos_agendados/cron abaixo) — acesso continua normal até lá, sem reembolso.
alter table organizations add column if not exists cancelamento_agendado_para timestamptz;

-- Mesma defesa que plano/valor_mensal/status_pagamento já tinham: só platform admin ou
-- service_role (Edge Function de assinatura) mexe nessas colunas.
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
  end if;
  return new;
end;
$$;

-- Roda 1x/dia: qualquer org com cancelamento agendado pro passado (ciclo pago já terminou)
-- desce pro plano grátis. O Mercado Pago já parou de cobrar no momento do cancelamento (ver
-- mercado-pago-cancelar-assinatura) — isso aqui só reflete no Actum o fim do período já pago.
create or replace function efetivar_cancelamentos_agendados() returns void
  language plpgsql security definer set search_path = public as $$
begin
  update organizations
  set plano = 'gratis', valor_mensal = 0, status_pagamento = 'pago',
      mercado_pago_subscription_id = null, assinatura_iniciada_em = null, cancelamento_agendado_para = null
  where cancelamento_agendado_para is not null and cancelamento_agendado_para <= now();
end;
$$;
select cron.schedule('efetivar-cancelamentos-assinatura-diario', '0 3 * * *', $$ select efetivar_cancelamentos_agendados(); $$);

-- lancar_cobrancas_plano (6 meses de uma vez) era pensado pra atribuição MANUAL de plano pelo
-- platform admin ("Configurar"), contrato combinado fora do Mercado Pago. Assinatura via
-- Payment Brick (mercado-pago-criar-assinatura) NÃO deve lançar isso — cada cobrança dessa
-- assinatura gera 1 linha por vez, só quando o webhook confirma o pagamento de verdade
-- (subscription_authorized_payment). Distingue os dois pelo mesmo update que a Edge Function
-- de assinatura sempre faz: setar mercado_pago_subscription_id junto com o plano.
create or replace function lancar_cobrancas_plano() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.plano is not null and new.valor_mensal is not null and new.mercado_pago_subscription_id is null
     and (old.plano is distinct from new.plano) then
    insert into platform_cobrancas (org_id, mes_referencia, valor, status)
    select new.id, (date_trunc('month', now()) + (n || ' months')::interval)::date, new.valor_mensal,
      case when n = 0 and new.status_pagamento = 'pago' then 'pago' else 'pendente' end
    from generate_series(0,5) as n
    on conflict (org_id, mes_referencia) do nothing;
  end if;
  return new;
end;
$$;
