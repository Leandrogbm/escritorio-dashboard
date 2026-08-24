# Roadmap — paridade com ProJuris

Checklist dos gaps identificados na comparação com o ProJuris (24/08/2026). Vamos fazendo
um de cada vez — marca `[x]` quando terminar e sobe. Ordenado por impacto pra um escritório
do tamanho da Gimenes & Pires (poucos usuários), não por facilidade técnica.

- [ ] **Portal do cliente** — cliente final loga (usuário/senha próprios) e vê status do
  próprio processo, sem falar com a equipe. Reaproveita boa parte do que já existe: novo
  `role = 'cliente'` em profiles (ou tabela separada), RLS restrita ao próprio `cliente_id`.
- [ ] **Captação automática de processo novo** — hoje o DataJud sync só atualiza processos
  já cadastrados manualmente; falta monitorar nome/OAB do advogado nos tribunais e avisar
  quando aparece processo novo.
- [ ] **GED — gestão de documentos por processo** — upload e organização de arquivo
  (petição, contrato, procuração) vinculado ao processo/cliente. Hoje não guardamos nenhum
  arquivo, só dado estruturado.
- [ ] **Assinatura eletrônica integrada** — nenhuma hoje.
- [ ] **IA jurídica sobre o conteúdo** — resumo automático de andamento, geração de petição,
  previsão de chance de êxito baseada em histórico. Depende do GED (item acima) pra ter o
  que resumir/gerar de verdade.
- [ ] **Kanban/workflow de tarefas por processo** — quadro de tarefas distribuídas na equipe.
- [ ] **Conciliação de depósito judicial** — específico pra garantia/depósito judicial,
  diferente da importação de extrato genérica que já existe (Financeiro → Importar extrato).
- [ ] **WhatsApp com atendimento integrado** — hoje só tem o link `wa.me` na tela de
  Clientes; eles têm atendimento de verdade dentro da plataforma.
- [ ] **App mobile** — só web hoje.
- [ ] **API pública / integrações externas (ERP, CRM)** — nenhuma hoje.
- [ ] **Multi-unidade (filiais sob uma conta)** — hoje é 1 organização = 1 escritório.
- [ ] **Relatórios/BI mais avançados e customizáveis** — Executivo hoje é fixo (poucos
  gráficos); eles têm dashboard configurável.

## Já não é gap — nota fiscal
Preparação de nota fiscal (dados + tabela `notas_fiscais`) já está pronta em back office,
só falta escolher provedor de emissão (Focus NFe/eNotas/PlugNotas) + certificado digital A1
pra ativar de verdade. Não entra nesta lista porque já está em andamento, não é gap novo.

## Fora da lista de propósito
- **Timesheet/controle de horas**: já existe no banco (`profiles.horas_mes/meta_horas`),
  foi tirado da tela a pedido do usuário — não é gap, é feature pausada. Reativar é rápido
  se algum dia quiser de volta.
