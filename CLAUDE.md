# Actum

SaaS multi-tenant de gestão jurídica pra escritórios de advocacia brasileiros. Cliente real
em produção: **Gimenes e Pires Sociedade de Advogados**. Nome anterior do projeto:
"mysaldo"/"Escritório Dashboard" (renomeado pra Actum — se achar referência antiga a
"mysaldo" em algum lugar, é resquício, corrigir quando encontrar).

## Stack

- **Frontend**: React 18 + Vite, Tailwind CSS. Sem router — navegação é `activeTab` (state)
  em `src/App.jsx`, cada módulo é um componente em `src/components/tabs/`.
- **Backend**: Supabase (Postgres + RLS + Auth + Edge Functions em Deno/TypeScript + Storage).
- **Deploy do frontend**: build estático, zip, upload manual pro Hostinger (não é CI/CD).
  Ver "Como publicar" abaixo.
- Gráficos: Recharts. Ícones: lucide-react. Mapa (feature em back log): Leaflet/react-leaflet
  **pinado em v4** (react-leaflet v5 exige React 19, esse projeto é React 18).
- OCR client-side (extrato em foto): tesseract.js. PDF: pdfjs-dist.

## Arquitetura de dados / permissões

- Multi-tenant por `org_id` em quase toda tabela, RLS em tudo. Helpers SQL:
  `auth_org_id()`, `auth_role()`, `has_module(module_key)`, `is_platform_admin()`.
- **Módulos** (`src/config/permissions.js`, array `MODULES`) definem o que aparece na
  Sidebar e o que cada cargo (`role_permissions`) pode ver. Mexeu num módulo aqui →
  mexer também no `check constraint` de `role_permissions.module` no schema.sql (já
  aconteceu de ficar dessincronizado).
- Cargos (`profiles.role`): `admin`, `socio`, `advogado`, `financeiro`, `recepcao`.
  `admin` sempre enxerga tudo (`has_module` retorna true direto pra admin, não olha
  `role_permissions`). Regra explícita do usuário: **admin não é "sócio automático"** —
  em telas como o Quadro de tarefas, só `socio` vê o quadro geral da equipe; admin vê só
  as próprias tarefas, igual qualquer outro cargo.
- **Platform admin** (não confundir com `admin` de uma org): entra em "modo suporte"
  (`emSuporte` em App.jsx) e opera como admin completo de QUALQUER empresa escolhida.
- **DataJud sync**: cron `datajud-sync-horario` roda de hora em hora (`pg_cron`, era 1x/dia
  antes) chamando a Edge Function `datajud-sync` — não depende mais de alguém clicar em
  "Sincronizar agora" (botão continua existindo pra forçar na hora). Ver `x-cron-secret` /
  `DATAJUD_CRON_SECRET` no header pra distinguir chamada do cron da chamada manual.

## ⚠️ Segurança — credenciais de integração (leia antes de mexer em Configurações/Integrações)

Teve um vazamento real já corrigido nesta base: `organizations` tem `SELECT` liberado pra
**qualquer** membro autenticado da empresa (precisa — nome/logo aparecem pra todo mundo no
Sidebar). Token de API (D4Sign, Asaas, Escavador, Trello) **nunca pode morar em colunas de
`organizations`** por causa disso — já aconteceu de vazar assim (qualquer cargo conseguia ler
via REST direto, e um componente chegava a mandar a chave pro browser de quem só estava
usando uma feature, não configurando nada).

Regra permanente: credencial de integração vai em **`integracoes`** (tabela própria, `org_id`
PK, RLS restrita a `auth_role() in ('admin','socio')`). Qualquer feature usada por cargo
não-admin precisa de uma Edge Function proxy que lê a credencial com service role e nunca
devolve ela pro client (ver `trello-proxy` como referência: recebe só a AÇÃO, nunca a chave).
Se precisar só saber "está conectado ou não" de um cargo qualquer, use um boolean público
tipo `organizations.trello_conectado`, sincronizado por trigger — nunca exponha o valor real
da chave pra checar truthiness.

**Antes de mexer em qualquer integração nova, ou revisar uma mudança que toca
`organizations`/`integracoes`/qualquer Edge Function de terceiro**, rode o sub-agente
`qa-guardian` (`.claude/agents/qa-guardian.md`) — ele tem o checklist de segurança completo e
o histórico de bugs de regressão pra conferir.

## Bugs reais já corrigidos — não reintroduzir (detalhe completo em `qa-guardian.md`)

1. CSS "containing block": `animation-fill-mode: both/forwards` com `transform` no keyframe
   final quebra `position: fixed` de modais aninhados — usar `backwards`.
2. Pendente vs atrasado não pode contar em dobro (Financeiro/ERP): "em aberto dentro do
   prazo" = pendente, "fora do prazo" = atrasado, nunca os dois.
3. Cards de resumo (Total/Pendente/Recebido) escopados ao mês/período selecionado, não
   soma de todo mês futuro já gerado por uma mensalidade/conta recorrente.
4. `<main>` é quem rola (não a `window`) — telas de página cheia (processo, documentos do
   cliente) precisam resetar `scrollTo({top:0})` ao abrir/fechar, senão o botão "Voltar"
   fica fora da tela.
5. `StatusPicker` usa portal + `position: fixed` calculado por `getBoundingClientRect()`
   (nunca `position: absolute` dentro de tabela com scroll — corta o dropdown).
6. Toda Edge Function que chama a API da Anthropic precisa de `AbortController` com timeout
   (~25s) — sem isso uma chamada lenta pendura a function até o limite do Supabase matar.
7. `extratoParser.js`: não filtrar valor negativo — positivo é entrada (honorário), negativo
   é saída (despesa). `ImportarExtratoModal.jsx` casa os dois na mesma leitura.
8. **Checkbox nunca marcado não pode virar `null` antes de salvar** — `RecordFormModal.jsx`
   convertia todo campo `undefined` (inclusive checkbox nunca clicado) em `null`. Coluna
   boolean `not null default false` recebendo `null` explícito ignora o default; se essa
   coluna também entra numa regra de RLS (ex.: `processos.confidencial`), a lógica de 3
   valores do SQL (`null and X` nunca é `true`) esconde a própria linha até de quem acabou
   de criar — aparece como `"new row violates row-level security policy"` num INSERT que
   "deveria" funcionar. Corrigido: `f.type === "checkbox"` sempre vira `!!v` (nunca null).
   Se aparecer esse erro de novo em qualquer tabela, suspeitar primeiro de checkbox
   não-marcado antes de mexer em RLS.

## Visibilidade de processo — confidencial, múltiplos responsáveis, "Sócios"

Já teve um **incidente real em produção** aqui: uma regra de "processo com 1 único
responsável que é sócio fica privado só pra esse sócio" foi ativada direto e escondeu TODOS
os processos de TODO mundo, porque na prática 100% dos processos reais compartilhavam o
mesmo sócio como responsável padrão (convenção de cadastro do cliente, não uma marcação de
confidencial). Foi revertida na hora. **Não inferir privacidade a partir da contagem de
responsável — só a partir de um campo explícito, ligado à mão.** É por isso que o desenho
atual é assim:

- `processo_responsaveis` (processo_id, profile_id): 1 processo pode ter **vários**
  advogados/sócios responsáveis. `processos.responsavel_id` continua existindo só como
  "responsável principal" (herdado por `set_prazo_data()`, usado no gráfico de carga de
  trabalho da Visão Executiva) — sincronizado sozinho por trigger
  (`sincroniza_responsavel_principal`, sempre o menor `profile_id` da lista atual).
  **Nunca escrever em `responsavel_id` direto** pra mudar quem é responsável — sempre via
  `processo_responsaveis` (inserir/apagar linha), o trigger cuida do resto.
- `eh_responsavel_do_processo(id)`: checa se `auth.uid()` é UM dos responsáveis (não só o
  principal). É `security definer` de propósito — sem isso, a RLS de `processos` chamando
  essa função dispara a RLS de `processo_responsaveis`, que reconsulta `processos` pro mesmo
  id → referência circular entre as duas policies. Como só responde sobre o PRÓPRIO
  `auth.uid()` (não aceita id de terceiro), rodar ignorando RLS por dentro não vaza nada.
- `processos.confidencial` (boolean): explícito, ligado por sócio/admin no form. Quando
  `true`, só quem está em `processo_responsaveis` (mais admin) enxerga o processo E o
  financeiro vinculado a ele (`honorarios_sel` segue a mesma regra via `processo_id`).
  Quando `false` (padrão), continua igual a sempre: só `advogado` é restrito ao próprio
  responsável, os outros cargos veem tudo.
- `processos.responsavel_socios` (boolean): explícito, separado de `confidencial`. Quando
  `true`, QUALQUER sócio (não só quem tá listado em `processo_responsaveis`) enxerga o
  processo mesmo sendo confidencial — pensado pra "isso é do escritório todo, não de 1
  pessoa só". Aparece como checkbox próprio no form, não é um valor dentro do dropdown de
  Responsáveis (já foi isso — um sentinela tipo `"__socios__"` dentro do mesmo `<select>` de
  responsável — e quebrou: a segunda cópia do formulário em `ProcessosTab.jsx` não sabia
  traduzir esse valor antes de mandar pro banco, e um `uuid` esperando receber a string
  `"__socios__"` estourava `invalid input syntax for type uuid`).
- `processo_privado_de_socio()`/`processo_visivel()`: **funções mortas**, ficam no
  `schema.sql` só de referência/histórico do que já foi tentado — nenhuma policy chama elas.
  Não reativar sem um critério novo que não seja "contar responsável".
- Editar quem é responsável no form é **multiselect** (`RecordFormModal` field
  `type: "multiselect"`), não select único — ver `ProcessosTab.jsx` (`salvarProcesso`): salva
  o processo primeiro, depois substitui o conjunto inteiro em `processo_responsaveis`
  (apaga tudo + insere de novo), nunca faz diff incremental.

## Limite de plano com oferta de upgrade

`plan_limits` (`limite_usuarios`/`limite_processos`/`limite_clientes`, `null` = sem limite) é
a fonte de verdade, aplicada de verdade via RLS (`processos_ins`/`clientes_ins` com check) e
na Edge Function `admin-create-user`. **Processo conta só ATIVO** (`status <> 'Encerrado'`)
contra o limite — arquivado não deveria travar a criação de um novo.

`src/config/planos.js` espelha isso só pra UX (rótulo, preço, checagem client-side antes de
abrir o form de "Novo" — `src/lib/limitesPlano.js` → `avisoLimitePlano()`) — **mudar limite
aqui sem mudar em `plan_limits` só desalinha o texto**, a trava real continua no banco. Ao
bater no limite, a mensagem já nomeia o próximo plano (preço/limites) em vez de deixar
estourar um erro cru de RLS/constraint.

## Exclusão de registro com peso real — confirmação digitada

`RowActions` aceita `confirmLabel`/`confirmCampo`: quando presentes, pede pra digitar o
valor exato (`src/lib/confirmarExclusao.js`) em vez do `confirm()` genérico de sempre — usado
em processo (número), cliente (nome, lista e página cheia), colaborador (nome — apaga o
login junto). Registro sem cascata de dado (prazo avulso, tarefa, depósito, lead) continua no
`confirm()` simples; só vale o esforço extra pra entidade que arrasta outras tabelas junto.
Mesmo padrão que `excluirEmpresa` (`PlatformAdminPanel.jsx`) já usava antes disso existir
como utilitário genérico.

## Cobrança da plataforma (Actum cobrando a própria empresa cliente)

Duas coisas diferentes, não confundir:
- `organizations.plano/valor_mensal/status_pagamento`: snapshot ATUAL (plano ativo agora).
- `platform_cobrancas`: ledger mês a mês de verdade (1 linha por mês), lançado 6 meses de
  uma vez (mínimo de contrato) toda vez que um plano é atribuído/trocado em "Configurar"
  (trigger `lancar_cobrancas_plano`). Clicar na linha da empresa no painel da plataforma
  (`PlatformAdminPanel.jsx`) abre `EmpresaCobrancas.jsx` com esse histórico.

`profiles.minutos_uso_total`/`ultimo_uso`: tempo de uso da plataforma por colaborador, só
admin lê (`equipe_tempo_uso()`, security definer — RLS não restringe coluna, só linha, por
isso a leitura passa por função em vez de vir direto da tabela/view). Incrementado por
heartbeat no client (`useAuth.js`, a cada 2min de aba visível).

## Convenção de teste (sempre, antes de dar como pronto)

Organização descartável via a própria Edge Function `signup-empresa`:
```
POST {SUPABASE_URL}/functions/v1/signup-empresa
  { nomeEmpresa, cnpj (14 dígitos, qualquer não usado), nomeResponsavel, email, password, termosAceitos: true }
```
(`termosAceitos: true` é obrigatório desde que o aceite de Termos/Privacidade virou parte do
cadastro — sem isso a function recusa com 400.)

JWT: `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` com email/senha. Exercita a
feature via `curl` direto no REST (`/rest/v1/<tabela>`) ou na Edge Function
(`/functions/v1/<nome>`) — mais rápido e conclusivo que dirigir a UI React.

Limpeza depois: sempre nessa ordem (FK) — tabelas dependentes → `auth.users` → `profiles` →
`organizations`. Escrever o SQL num arquivo de scratchpad e rodar com
`npx supabase db query --linked -f <arquivo>.sql` (string inline `-e` já deu erro "Too
small" nesse projeto). Nunca deixar dado de teste em produção.

Pra testar lógica de IA isolada (sem gastar chamada real de tribunal), dá pra subir uma Edge
Function descartável temporária que chama só a parte de IA direto (nome de função não pode
começar com `_` — regra do Supabase) e apagar (`supabase functions delete <nome>`) depois do
teste — feito isso pra validar `classificarComIA`.

## Como publicar

Desde que `.github/workflows/deploy.yml` foi criado, **`git push origin main` já builda e
sobe pro Hostinger sozinho via FTP** (GitHub Actions) — não depende mais de gerar
`actum-build.zip` e subir manual pelo File Manager. Só falta o usuário configurar os
secrets do repositório no GitHub uma vez (Settings → Secrets and variables → Actions):
`FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` (Hostinger hPanel → Files → Contas FTP),
`FTP_SERVER_DIR` (pasta de destino, ex. `public_html/` ou
`domains/seudominio.com/public_html/`), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
(mesmos valores do `.env` local — o build do Actions não tem acesso ao `.env`, que não é
commitado). Sem esses secrets configurados, o workflow falha e o site NÃO é atualizado —
checar a aba "Actions" do repo no GitHub se uma mudança não aparecer no ar.

Ainda dá pra gerar o zip manualmente como fallback (rodar sem o workflow, ou se os secrets
ainda não estiverem configurados):
```
npx vite build
powershell -Command "Compress-Archive -Path dist\* -DestinationPath actum-build.zip -Force"
git add -A
git commit -m "..."
git push origin main
```
Se os secrets do Actions ainda não estiverem configurados, **o usuário ainda precisa subir o
zip manualmente** — isso já foi confundido com "bug" mais de uma vez (feature simplesmente
não tinha sido publicada ainda). Enquanto não confirmar que o deploy automático está
funcionando (checar a aba Actions), continuar lembrando disso no fim de qualquer entrega de
frontend.

Edge Function nova/alterada: `npx supabase functions deploy <nome>` (`--no-verify-jwt` só
pra function chamada sem JWT de usuário — cron, webhook interno com secret próprio no
header). Schema novo: escrever em scratchpad SQL e rodar com `npx supabase db query --linked
-f <arquivo>` **e também mirrorar a mudança em `supabase/schema.sql`** (esse arquivo é o
"rodar isso inteiro num projeto novo do zero", não um changelog de migração — editar em
lugar, não acrescentar `ALTER`/`DROP` no fim).

## Padrões de código que já existem — seguir, não reinventar

- **`embutido` prop**: componente que serve como modal standalone OU conteúdo puro dentro de
  outra tela (`MovimentacoesPanel`, `TarefasPanel`, `DepositosPanel`, `DocumentosPanel`,
  `ExecutivoTab`). `embutido=false` (padrão) renderiza com moldura de modal/página própria;
  `true` renderiza só o conteúdo, pra encaixar como sub-aba/painel embutido em outra tela.
- **"ponytail" — features prontas mas seguradas em back log**: código/schema/Edge Function
  ficam intactos, só a UI some (`{false && (<JSX/>)}` com comentário explicando por que e
  onde reativar). Usado pra Asaas, rentabilidade por área, funil de leads, captação de leads
  público. Ver `ROADMAP-comparativo.md` pro motivo de cada um.
- **Clique na linha inteira** abre editar/ver, não só o ícone de lápis — padrão em
  Clientes/Processos/Financeiro/Prazos/Depósitos/ERP.
- **StatusPicker**: clicar direto no badge de status muda ele (em vez de precisar abrir
  editar) — usado em Processos, Financeiro, ERP, Depósitos.
- **Sino por entidade** (`ClienteBell`, `ProcessoBell`, `FornecedorBell`): "possível
  pagamento"/notificação específica daquele registro, com confirmar/rejeitar — diferente do
  sino geral (que só cobre movimentação/prazo, não pagamento).

## Onde procurar antes de perguntar

- `ROADMAP-comparativo.md` / `ROADMAP-projuris.md`: gaps já pesquisados vs concorrentes
  (AdvBox, LiderHub, ZapSign, Asaas, Projuris, Astrea, Legal One, CPJ-3C, GOJUR, LegalSuite,
  Themis) — o que já foi construído, o que foi decidido segurar, o que depende de provedor
  pago (não é gap técnico, é decisão de compra).
- `.claude/agents/qa-guardian.md`: sub-agente de QA/regressão/segurança — invocar antes de
  dar uma mudança sensível como pronta (integrações, RLS, extrato, financeiro/ERP).
- Regras éticas já aplicadas (não renegociar sem pedido explícito e refletido): recusa
  construir "captação ativa" de cliente — contatar parte de processo alheio recém-distribuído,
  ou vasculhar rede social/fórum atrás de gente com dúvida jurídica pra oferecer serviço —
  por vedação do Código de Ética da OAB (arts. 5º-7º/39-41), independente da fonte ser
  processo público ou post em rede social.
