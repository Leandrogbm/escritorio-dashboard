-- E-mail do financeiro de cada escritório: vira reply-to dos lembretes de cobrança (o envio
-- continua por nao-responda@actumjus.com.br, com o nome do escritório como remetente).
alter table organizations add column if not exists email_cobranca text;
notify pgrst, 'reload schema';
