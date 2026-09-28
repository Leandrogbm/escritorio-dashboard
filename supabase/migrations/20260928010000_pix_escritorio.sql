-- Cobrança via Pix gerado pelo próprio escritório (sem plataforma de pagamento no meio).
-- Chave Pix é pra ser mostrada ao pagador, então NÃO é credencial secreta — mora em
-- organizations mesmo (diferente de token de API, ver regra em CLAUDE.md). Editável por
-- admin/sócio da própria empresa pela aba Minha Empresa (RLS organizations_self_upd já
-- cobre; guard_organizations_protected_cols não lista essas colunas, então não precisa mexer
-- no trigger — só quem já é admin/sócio da empresa consegue dar update em organizations).
alter table organizations add column if not exists pix_chave text;
alter table organizations add column if not exists pix_nome_recebedor text;
alter table organizations add column if not exists pix_cidade text;
