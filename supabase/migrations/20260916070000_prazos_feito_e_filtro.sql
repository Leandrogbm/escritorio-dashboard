-- Botão "feito" em cada prazo (pedido do usuário) — marca cumprido sem precisar excluir
-- (histórico continua, só sai da urgência visual). Filtro por data é só front-end, não
-- precisa de coluna nova.
alter table prazos add column if not exists feito boolean not null default false;
