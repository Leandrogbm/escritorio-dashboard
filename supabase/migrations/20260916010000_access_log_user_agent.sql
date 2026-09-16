-- Painel da plataforma ("Acessos recentes") só mostrava dia/quantidade/tempo/IP — pedido do
-- usuário pra ver TUDO que dá: horário exato do primeiro acesso do dia (já calculado no
-- client, só faltava exibir) e agora também dispositivo/navegador, que não era capturado.
alter table access_log add column if not exists user_agent text;
