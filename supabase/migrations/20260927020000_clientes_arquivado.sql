-- Arquivo: cliente sem pendência (processos encerrados, honorários pagos, sem prazo em
-- aberto) sai das listas de Clientes/Processos e fica só no "Arquivo". Regra checada na tela
-- (ClientePagina) — arquivar é reversível e não é controle de acesso.
alter table clientes add column if not exists arquivado boolean not null default false;
alter table processos add column if not exists arquivado boolean not null default false;
