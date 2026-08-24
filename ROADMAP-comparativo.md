# Comparativo — AdvBox, LiderHub, ZapSign, Asaas, IA como gestor interno

Pesquisa feita em 24/08/2026. Não é reimplementação 1:1 de nenhum concorrente — é
"o que dessas plataformas resolve um problema real que a gente ainda resolve na mão
(ou nem resolve)". Ordenado por impacto ÷ esforço, do que vale mais a pena primeiro.

## 1. Asaas — cobrança automática (maior gap real, financeiro)

Hoje: `honorarios` é só controle manual — você lança a cobrança, o cliente paga por fora
(PIX na conta do escritório, boleto avulso etc.), e a gente casa com o extrato importado
(valor+nome+data) pra marcar como pago. Funciona, mas é 100% reativo.

Asaas gera a cobrança de verdade (boleto com QR Pix junto, link de pagamento, cartão),
manda pro cliente, e devolve **webhook quando paga** — sem precisar importar extrato nem
adivinhar por nome. Também tem assinatura recorrente nativa (looks like nossa "mensalidade
PJ"/"parcelas PF", já modelado igual) e nota fiscal integrada (que já está no nosso
back office esperando provedor).

**O que dá pra fazer:**
- Integração Asaas por escritório (conta própria, mesmo padrão do D4Sign — token colado
  em Configurações): ao criar um `honorario`, gerar a cobrança no Asaas e guardar o link/
  QR Pix pra mandar ao cliente; webhook `PAYMENT_RECEIVED` marca `status = 'Pago'` sozinho.
- Isso **substitui** o fluxo de importar extrato pra esse cliente (continua existindo pra
  quem não usa Asaas / paga por fora).
- Nota fiscal: Asaas também emite NF-e/NFS-e integrada — pode ser o provedor que falta
  pra ativar o que já está pronto no back office.

**Esforço**: médio (API bem documentada, webhook simples). **Impacto**: alto — elimina
trabalho manual real e problema de UX que existe hoje (`extrato` é sempre catch-up).

## 2. LiderHub — funil de captação via WhatsApp (inbound, não é o que recusei antes)

Importante distinguir do que já recusei: LiderHub gerencia conversa que **o cliente em
potencial inicia** com o escritório (WhatsApp, indicação, anúncio) — não é contatar parte
de processo alheio pra oferecer serviço (isso continua fora, por ética OAB). É CRM de
funil: Lead → Consulta agendada → Proposta → Contrato assinado, focado em previdenciário/
trabalhista (que costuma ter volume de leads via WhatsApp).

Hoje não temos nada disso — `clientes` só existe depois que já é cliente. Não tem etapa
de "possível cliente conversando mas ainda não fechou".

**O que dá pra fazer:**
- Tabela `leads` (nome, telefone, origem, etapa do funil, observações) + Kanban parecido
  com o Quadro de tarefas que já construímos (colunas = etapas do funil).
- "Converter em cliente" quando fecha — vira um registro em `clientes` de verdade.
- Integração com WhatsApp de verdade (receber/responder mensagem) é o pulo do gato do
  LiderHub e é bem mais caro/complexo (precisa WhatsApp Business API, provedor pago —
  mesma categoria do "WhatsApp integrado" que já está bloqueado no roadmap principal).
  Sem isso, ainda é útil: só o Kanban de funil, alimentado manualmente, já organiza.

**Esforço**: baixo pro Kanban de funil (reaproveita o padrão que já existe), alto se
quiser WhatsApp automático de verdade. **Impacto**: médio-alto pra escritório que já
capta bastante lead solto — hoje isso vive em planilha ou na cabeça de alguém.

## 3. AdvBox — pontos específicos que eles têm e a gente não

Concorrente direto, boa parte já coberta no `ROADMAP-projuris.md`. Três coisas novas que
apareceram na pesquisa e ainda não estão no nosso roadmap:

- **Rentabilidade por tipo de ação (BI)**: cruzar `processos.area` com `honorarios`
  (receita) e horas/tarefas (custo, se reativar timesheet) pra saber que tipo de causa
  dá mais lucro. Dá pra fazer com o que já existe no banco — é só um gráfico novo na
  Visão Executiva, sem tabela nova. Esforço baixo, impacto depende do escritório querer
  esse tipo de decisão gerencial.
- **Contingenciamento processual**: classificar processo por risco (provável/possível/
  remoto) pra fins contábeis (provisão de perda, relevante principalmente pra empresa que
  é RÉ, não autora). Fora do escopo de um escritório de advocacia comum — é mais uma
  necessidade do CLIENTE (empresa) do que do escritório. Baixa prioridade a menos que
  peçam explicitamente.
- **"Agentes de IA" pra peticionamento** (aquisição da LawX): é exatamente o item
  "geração de petição" que já está listado como pendente no roadmap principal — precisa
  de templates do escritório, mesmo bloqueio de sempre.

## 4. ZapSign — alternativa mais barata ao D4Sign, mesma categoria

Mesma função que o D4Sign que já construímos (assinatura eletrônica, conta própria por
escritório), só que mais barata pra volume baixo e com confirmação de identidade via
WhatsApp (R$0,50/assinatura). Não é gap — é opção de provedor.

**O que dá pra fazer**: se o D4Sign não validar bem quando o Gimenes & Pires testar de
verdade (ainda não testamos com conta real, está anotado no roadmap), trocar ou oferecer
os dois como opção é reaproveitar quase toda a tela de Integrações já pronta (troca só a
chamada da API, o padrão de token colado continua igual).

**Esforço**: baixo (se precisar). **Impacto**: só relevante se D4Sign não performar bem.

## 5. IA como gestor interno / colaborador / criador de procedimentos e estratégia

Isso não é um produto concorrente, é uma direção de produto. Já temos duas pontas desse
fio puxadas nesta sessão: resumo automático de andamento e detecção de urgência por IA.
Dá pra esticar em três direções, em ordem de quão pronto pra construir cada uma está:

1. **IA sugere o próximo passo processual** (fácil, dá pra construir já): mesmo padrão do
   resumo — olha as movimentações + status do processo e sugere "próxima ação sugerida"
   (ex.: "prazo de contestação provavelmente vence em breve, considere protocolar"). Não
   decide nada sozinha, só sugere — advogado confirma. Reaproveita 100% da infra que já
   existe (`resumir-andamentos`, mesmo padrão de prompt).
2. **IA monta checklist/procedimento padrão por tipo de ação** (médio): quando cria um
   processo novo de uma área específica (ex.: "Trabalhista — Rescisão indireta"), a IA
   sugere um checklist inicial de tarefas (usando o Quadro de tarefas que já existe) —
   precisa de um "roteiro padrão" por área, que pode vir de prompt genérico (IA já sabe o
   procedimento típico) ou de templates que o próprio escritório cadastra (mais confiável,
   mais trabalho de setup).
3. **IA sugere estratégia jurídica / chance de êxito** (difícil, já sinalizado como
   bloqueado no roadmap principal): precisa de base de jurisprudência/precedentes — ou
   histórico de resultado do próprio escritório (que ainda não guardamos: não existe
   campo "resultado do processo" em `processos`) ou um provedor externo pago com base de
   jurisprudência (tipo Jusbrasil Soluções, que já foi removido por não ser o produto do
   cliente, ou similares). Sem isso, qualquer "sugestão de estratégia" vira só o
   conhecimento genérico do modelo, sem embasamento nos casos reais — soa convincente mas
   pode estar errado, risco maior que os outros dois itens.

**Recomendação de ordem**: 1 → 2 → 3. O item 1 é praticamente grátis (mesma function,
prompt novo). O item 2 já é bom valor com esforço baixo/médio. O item 3 só vale a pena
com uma fonte de dados real por trás — senão é enfeite arriscado.

## Prioridade sugerida geral (impacto × esforço)

- [x] **Asaas** — cobrança automática (boleto/Pix/cartão, webhook marca "Pago" sozinho).
  Conta própria por escritório (Configurações → Cobrança automática), ambiente sandbox/
  produção. ⚠️ Sem teste contra conta real (não temos credencial) — testado tudo que dava
  sem conta (erro amigável faltando credencial) e o webhook isoladamente (simulado, sem
  precisar de conta Asaas de verdade); o caminho que fala com a Asaas de verdade só valida
  na primeira tentativa real de vocês.
- [x] **IA — próximo passo sugerido** — junto com o resumo automático de andamento (1
  chamada só). Testado contra processo real de produção.
- [x] **LiderHub — Kanban de funil de leads** (sem WhatsApp automático, só o board manual).
  Testado de ponta a ponta com empresa descartável.
- [x] **AdvBox — rentabilidade por tipo de ação** — gráfico na Visão Executiva, só
  honorários vinculados a processo entram (campo "Processo" opcional na cobrança).
- [x] **IA — checklist padrão por área** — botão "Sugerir checklist (IA)" no Kanban de
  tarefas do processo, só aparece quando ainda não tem nenhuma tarefa. Testado direto
  contra a function.
- [ ] ZapSign / contingenciamento / IA-estratégia — ficam de standby, só entram se surgir
  necessidade concreta (D4Sign falhar, cliente pedir provisionamento, base de
  jurisprudência aparecer)

Fontes: [ADVBOX — Software Jurídico](https://advbox.com.br/software-juridico),
[ADVBOX adquire LawX](https://www.direitonews.com.br/2026/08/advbox-adquire-lawx-anuncia-nova-geracao-inteligencia-artificial-escritorios-advocacia.html),
[LiderHub docs](https://docs.liderhub.ai/),
[ZapSign API](https://blog.zapsign.com.br/zapsign-api/),
[Asaas — cobrança recorrente](https://blog.asaas.com/cobranca-recorrente-no-asaas/),
[Asaas — Pix Automático](https://docs.asaas.com/docs/pix-automatico).
