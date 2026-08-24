# Roadmap — paridade com ProJuris

Checklist dos gaps identificados na comparação com o ProJuris (24/08/2026). Reordenado do
mais fácil pro mais difícil (24/08, 2ª leva) — indo um de cada vez, marca `[x]` quando
terminar e sobe.

- [x] **Portal do cliente** — cliente final loga (usuário/senha próprios) e vê status do
  próprio processo, andamentos e cobranças, sem falar com a equipe. Tabela separada
  `cliente_logins` (não mistura com Equipe/profiles), RLS só-leitura restrita ao próprio
  `cliente_id`. Botão "Criar acesso" na aba Clientes (admin/sócio). Testado de ponta a ponta
  com empresa descartável: leitura scoped confirmada, escrita bloqueada pela RLS.
- [ ] **Kanban/workflow de tarefas por processo** — quadro de tarefas distribuídas na equipe.
- [ ] **Relatórios/BI mais avançados e customizáveis** — Executivo hoje é fixo (poucos
  gráficos); eles têm dashboard configurável.
- [ ] **Conciliação de depósito judicial** — específico pra garantia/depósito judicial,
  diferente da importação de extrato genérica que já existe (Financeiro → Importar extrato).
- [ ] **GED — gestão de documentos por processo** — upload e organização de arquivo
  (petição, contrato, procuração) vinculado ao processo/cliente. Hoje não guardamos nenhum
  arquivo, só dado estruturado.
- [ ] **Captação automática de processo novo** — hoje o DataJud sync só atualiza processos
  já cadastrados manualmente; falta monitorar nome/OAB do advogado nos tribunais e avisar
  quando aparece processo novo.
- [ ] **API pública / integrações externas (ERP, CRM)** — nenhuma hoje.
- [ ] **WhatsApp com atendimento integrado** — depende de provedor pago (WhatsApp Business
  API / Twilio / Z-API) — vou preparar o back office e sinalizar quando chegar nesse item,
  igual fiz com nota fiscal.
- [ ] **Assinatura eletrônica integrada** — depende de provedor pago (Clicksign/D4Sign/
  DocuSign) — mesma situação do item acima.
- [ ] **Multi-unidade (filiais sob uma conta)** — hoje é 1 organização = 1 escritório; mudar
  isso mexe em quase todo o modelo de dados.
- [ ] **IA jurídica sobre o conteúdo** — resumo automático de andamento, geração de petição,
  previsão de chance de êxito. Depende do GED (ter documento pra resumir/gerar) e de custo
  de API de IA por chamada — vou preparar o que der e sinalizar a parte que depende de custo.
- [ ] **App mobile** — só web hoje; publicar em loja é projeto à parte (conta de
  desenvolvedor, build nativo/PWA, processo de revisão da Apple/Google).

## Já não é gap — nota fiscal
Preparação de nota fiscal (dados + tabela `notas_fiscais`) já está pronta em back office,
só falta escolher provedor de emissão (Focus NFe/eNotas/PlugNotas) + certificado digital A1
pra ativar de verdade. Não entra nesta lista porque já está em andamento, não é gap novo.

## Fora da lista de propósito
- **Timesheet/controle de horas**: já existe no banco (`profiles.horas_mes/meta_horas`),
  foi tirado da tela a pedido do usuário — não é gap, é feature pausada. Reativar é rápido
  se algum dia quiser de volta.
