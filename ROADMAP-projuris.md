# Roadmap — paridade com ProJuris

Checklist dos gaps identificados na comparação com o ProJuris (24/08/2026). Reordenado do
mais fácil pro mais difícil (24/08, 2ª leva) — indo um de cada vez, marca `[x]` quando
terminar e sobe.

- [x] **Portal do cliente** — cliente final loga (usuário/senha próprios) e vê status do
  próprio processo, andamentos e cobranças, sem falar com a equipe. Tabela separada
  `cliente_logins` (não mistura com Equipe/profiles), RLS só-leitura restrita ao próprio
  `cliente_id`. Botão "Criar acesso" na aba Clientes (admin/sócio). Testado de ponta a ponta
  com empresa descartável: leitura scoped confirmada, escrita bloqueada pela RLS.
- [x] **Kanban/workflow de tarefas por processo** — quadro de tarefas distribuídas na equipe.
  Tabela `tarefas`, RLS igual prazos/processos, botão "Tarefas" em cada card de Processos.
- [x] **Relatórios/BI mais avançados** — Visão Executiva ganhou "processos por situação"
  (pizza) e "carga de trabalho por responsável" (barra). Customização de dashboard (usuário
  escolher quais cards vê) ficou de fora — desproporcional pro tamanho do escritório.
- [x] **Depósitos judiciais** — tabela `depositos_judiciais`, painel por processo (tipo,
  valor, status, banco, comprovante). Não é "conciliação bancária" de verdade porque esse
  dinheiro nem passa pela conta do escritório — é acompanhamento do ciclo de vida.
- [x] **GED básico** — bucket privado `documentos-processo` + tabela `documentos_processo`.
  Upload/lista/download (URL assinada)/exclusão por processo. Sem templates de petição nem
  geração automática — isso é a parte de IA, item mais abaixo na lista.
- [ ] **Captação automática de processo novo** — ⚠️ pesquisei a fundo: a API pública do
  DataJud (a que já usamos) **não tem campo de advogado/OAB/parte** no schema documentado
  (só numeroProcesso, classe, órgão julgador, assuntos, movimentos —
  [glossário oficial](https://datajud-wiki.cnj.jus.br/api-publica/glossario/)). Buscar
  processo novo por OAB só dá com provedor pago (Judit, Escavador etc.) — mesma categoria
  do WhatsApp/assinatura abaixo. Fica pra quando decidir contratar um desses.
- [x] **API pública** — chave de acesso (Configurações → API pública), Edge Function
  api-gateway com GET/POST clientes, GET processos/honorarios. Achei e corrigi um bug real
  no processo (trg_set_org_id sobrescrevia org_id com null em insert via service_role).
- [x] **App mobile (parcial: PWA)** — manifest + service worker + ícone. "Adicionar à tela
  inicial" no Android/iOS abre em tela cheia como app. Não é app nativo em loja (Apple/
  Google) — isso é projeto à parte (conta de desenvolvedor, build nativo, revisão).

## Bloqueados por decisão de negócio (provedor pago) — não são gap técnico, são compra a fazer

- [ ] **WhatsApp com atendimento integrado** — precisa de WhatsApp Business API / Twilio /
  Z-API (provedor pago). Quando escolher um, volto e conecto.
- [ ] **Assinatura eletrônica integrada** — precisa de Clicksign/D4Sign/DocuSign (provedor
  pago). Mesma situação.
- [ ] **IA jurídica sobre o conteúdo** — resumo automático de andamento, geração de petição,
  previsão de chance de êxito. GED (documento por processo) já está pronto — falta decidir
  provedor de IA e custo por chamada.
- [ ] **Captação automática de processo novo** — API pública do DataJud não tem campo de
  advogado/OAB (confirmado no glossário oficial); precisa de provedor pago (Judit, Escavador).

## Fica de fora por enquanto (risco alto pra fazer com pressa)

- [ ] **Multi-unidade (filiais sob uma conta)** — hoje é 1 organização = 1 escritório.
  Fazer direito exige reabrir a RLS de toda tabela operacional (mesmo tipo de superfície do
  "admin mestre" cross-org, mas pra qualquer admin de matriz, não só platform admin) — prefiro
  não apressar isso, é decisão de segurança que merece uma sessão dedicada só pra ela.

## Já não é gap — nota fiscal
Preparação de nota fiscal (dados + tabela `notas_fiscais`) já está pronta em back office,
só falta escolher provedor de emissão (Focus NFe/eNotas/PlugNotas) + certificado digital A1
pra ativar de verdade. Não entra nesta lista porque já está em andamento, não é gap novo.

## Fora da lista de propósito
- **Timesheet/controle de horas**: já existe no banco (`profiles.horas_mes/meta_horas`),
  foi tirado da tela a pedido do usuário — não é gap, é feature pausada. Reativar é rápido
  se algum dia quiser de volta.
