# Actum

SaaS multi-tenant de gestão jurídica pra escritórios de advocacia brasileiros. Cliente real
em produção: **Gimenes e Pires Sociedade de Advogados**. Nome anterior do projeto:
"mysaldo"/"Escritório Dashboard" (renomeado pra Actum — se achar referência antiga a
"mysaldo" em algum lugar, é resquício, corrigir quando encontrar).

## Stack

- **Frontend**: React 18 + Vite, Tailwind CSS. Sem router — navegação é `activeTab` (state)
  em `src/App.jsx`, cada módulo é um componente em `src/components/tabs/`.
- **Backend**: Supabase (Postgres + RLS + Auth + Edge Functions em Deno/TypeScript + Storage).
- **Deploy do frontend**: automático — `git push origin main` builda e sobe sozinho no
  Hostinger via GitHub Actions (`.github/workflows/deploy.yml`, FTPS). Ver "Como publicar".
- Gráficos: Recharts. Ícones: lucide-react. Mapa (feature em back log): Leaflet/react-leaflet
  **pinado em v4** (react-leaflet v5 exige React 19, esse projeto é React 18).
- OCR client-side (extrato em foto): tesseract.js. PDF: pdfjs-dist.

## Arquitetura de dados / permissões

- Multi-tenant por `org_id` em quase toda tabela, RLS em tudo. Helpers SQL:
  `auth_org_id()`, `auth_role()`, `has_module(module_key)`, `is_platform_admin()`.
- **Módulos** (`src/config/permissions.js`, array `MODULES`) definem o que aparece na
  Sidebar e o que cada cargo (`role_permissions`) pode ver. Mexeu num módulo aqui →
  mexer também no `check constraint` de `role_permissions.module` no schema.sql (já
  aconteceu de ficar dessincronizado — é o erro recorrente #1 desse projeto).
- Cargos (`profiles.role`): `admin`, `socio`, `advogado`, `financeiro`, `recepcao`.
  `admin` sempre enxerga tudo (`has_module` retorna true direto pra admin). Regra explícita
  do usuário: **admin não é "sócio automático"** — isso é uma exceção específica do Quadro de
  tarefas (só `socio` vê o quadro geral da equipe), não presumir que vale em outra tela.
- **Platform admin** (não confundir com `admin` de uma org): entra em "modo suporte"
  (`emSuporte` em App.jsx) e opera como admin completo de QUALQUER empresa escolhida.
- Detalhe de implementação de qualquer feature específica (Trello, DataJud, confidencial de
  processo, cobrança da plataforma etc.) fica no arquivo do agente que constrói/mantém
  aquilo (`builder.md`) ou nos comentários do próprio código — não duplicar aqui.

## ⚠️ Segurança — credenciais de integração (regra permanente, não renegociar)

`organizations` tem `SELECT` liberado pra qualquer membro autenticado da empresa (precisa —
nome/logo aparecem pra todo mundo). Por causa disso, **token de API (D4Sign, Asaas,
Escavador, Trello) nunca pode morar em coluna de `organizations`** — já vazou assim uma vez.
Credencial de integração vai em **`integracoes`** (tabela própria, RLS restrita a
`auth_role() in ('admin','socio')`). Feature usada por cargo não-admin precisa de Edge
Function proxy que lê a credencial com service role e nunca devolve pro client (ver
`trello-proxy`). Pra saber só "está conectado ou não", usar boolean público tipo
`organizations.trello_conectado`, nunca o valor real da chave.

Antes de mexer em qualquer integração nova, ou revisar algo que toca
`organizations`/`integracoes`/Edge Function de terceiro, rodar `qa-guardian` — checklist de
segurança completo está lá, não duplicado aqui.

## Regras éticas já aplicadas — não renegociar sem pedido explícito e refletido

Recusa construir "captação ativa" de cliente jurídico: contatar parte de processo alheio,
vasculhar rede social/fórum atrás de dúvida jurídica, ou buscar empresa por região/raio pra
oferecer serviço — vedado pelo Código de Ética da OAB (arts. 5º-7º/39-41), **a doutrina trata
a própria compilação de contato não solicitado como o ato vedado, não só o envio da
mensagem** — independente da fonte (rede social, Google, agregador pago). Isso já foi pedido
3x em formas diferentes e recusado nas 3 (histórico completo em `ROADMAP-comparativo.md`).
Modelo aceito: só **inbound** (empresa/cliente procura o escritório sozinho — formulário
público, WhatsApp, indicação). `leads_captacao` (formulário+mapa) existe pronta no código mas
está em back log a pedido do usuário — não reativar sem pedido novo e explícito.

## Regra permanente: rodar os sub-agentes sempre, não só quando lembrar

Antes de dar qualquer mudança como pronta:
- **`qa-guardian`** — sempre, sem exceção, pra mudança que toque banco/RLS/Edge
  Function/regra de negócio. Já pegou bug real que passaria despercebido mais de uma vez.
- **`arquiteto`** — mudança de arquitetura/schema não trivial (nova tabela, nova policy,
  nova relação entre tabelas).
- **`frontend-designer`** — tela/componente/padrão visual novo (não precisa pra ajuste de
  1 linha de texto).

Background é aceitável (dá pra seguir trabalhando enquanto roda) — mas reportar o resultado
real pro usuário, nunca só assumir que passou.

## Convenção de teste (sempre, antes de dar como pronto)

Organização descartável via `signup-empresa`:
```
POST {SUPABASE_URL}/functions/v1/signup-empresa
  { nomeEmpresa, cnpj (14 dígitos, qualquer não usado), nomeResponsavel, email, password, termosAceitos: true }
```
(`termosAceitos: true` obrigatório — sem isso a function recusa com 400.)

JWT via `POST {SUPABASE_URL}/auth/v1/token?grant_type=password`. Exercitar via `curl` direto
no REST/Edge Function é mais rápido e conclusivo que dirigir a UI. Simular sessão específica
sem precisar logar de verdade: `begin; set local role authenticated; set local
request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'; ...; rollback;` via `npx
supabase db query --linked -f <arquivo>.sql`.

Limpeza sempre nessa ordem (FK): tabelas dependentes → `auth.users` → `profiles` →
`organizations`. Nunca deixar dado de teste em produção.

## Como publicar

Deploy automático (`.github/workflows/deploy.yml`, FTPS) já configurado e testado. **"GitHub
Actions verde" não é prova de que o site mudou** — só prova que o upload não deu erro (já
aconteceu do `FTP_SERVER_DIR` apontar pra pasta errada, ~10 deploys "sucesso" seguidos sem
o site real mudar nada, por horas). Se o usuário disser que uma mudança não apareceu no ar
mesmo com deploy verde: `curl -s https://mysaldo.com.br/ | grep assets` pra achar o hash do
bundle ao vivo, comparar com o hash que o `Build` step do último workflow run gerou (`gh run
view <id> --log | grep "dist/assets/index-"`) — só depois de confirmar que os hashes NÃO
batem é que faz sentido investigar isso; se baterem, aí sim é cache do navegador do usuário.

**Confirmar rápido se o arquivo no ar é mesmo o mais novo** (mais direto que comparar hash de
build): `curl -s --ftp-ssl -k "ftp://<user>:<senha>@ftp.mysaldo.com.br/" 2>&1 | grep index.html`
mostra a data de modificação real do `index.html` no servidor — compara com `curl -sI
https://mysaldo.com.br/ | grep -i last-modified`. Se as duas baterem mas ainda assim
antigas, o problema é upload que não gravou (já aconteceu do Actions logar "sucesso" e
"replacing index.html" byte a byte, várias vezes seguidas, sem o arquivo mudar de verdade
no FTP — causa não confirmada, suspeita de atraso de réplica do lado do Hostinger).

Fallback manual (publica sem depender do Actions, funciona de dentro da sessão mesmo):
```
npx vite build
node -e "require('basic-ftp')" 2>/dev/null || npm i --no-save basic-ftp
```
depois um script Node de ~15 linhas com `basic-ftp` (`client.access({host,user,password,secure:true,secureOptions:{rejectUnauthorized:false}})`
seguido de `client.uploadFromDir('dist', '/')`) sobe tudo direto, sem zip nem File Manager —
mais rápido de confirmar (dá pra checar o mtime no FTP na hora) que esperar o Actions.
Zip pro usuário subir manualmente pelo File Manager (`Compress-Archive -Path dist\*
-DestinationPath actum-build.zip -Force`) continua valendo como opção quando quem publica é
o usuário, não uma sessão com acesso a `Bash`/Node.

Edge Function nova/alterada: `npx supabase functions deploy <nome>` (`--no-verify-jwt` só
pra function chamada sem JWT de usuário). Schema novo: rodar via `npx supabase db query
--linked -f <arquivo>` **e mirrorar em `supabase/schema.sql`** (é o "rodar isso inteiro num
projeto novo do zero", não um changelog — editar em lugar, não acrescentar no fim).

## Padrões de código — nomes rápidos, detalhe fica no código/no agente que construiu

- **`embutido` prop**: componente serve como modal standalone OU conteúdo embutido em outra
  tela — `MovimentacoesPanel`, `TarefasPanel`, `DepositosPanel`, `DocumentosPanel`, `ExecutivoTab`.
- **"ponytail"**: feature pronta mas segurada em back log — código/schema/Edge Function
  intactos, só a UI some (`{false && (<JSX/>)}` com comentário). Ver `ROADMAP-comparativo.md`
  pro motivo de cada uma (Asaas, rentabilidade por área, funil de leads, `leads_captacao`).
- **Clique na linha inteira** abre editar/ver — Clientes/Processos/Financeiro/Prazos/Depósitos/ERP.
- **`StatusPicker`**: clicar no badge muda o status direto, sem abrir editar.
- **Sino por entidade** (`ClienteBell`/`ProcessoBell`/`FornecedorBell`): notificação
  específica daquele registro (ex.: possível pagamento) — diferente do sino geral.
- **`AREAS_DIREITO_COMUNS`** (`src/config/areasDireito.js`): lista de sugestão reaproveitada
  em mais de um campo (Área do direito, Origem do cliente) — não criar lista nova igual.
- **Trello embutido de verdade** (não iframe, a Trello bloqueia via CSP própria):
  `TrelloQuadro.jsx`/`TrelloCardModal.jsx` via `trello-proxy` (credencial nunca chega no
  browser).

Detalhe de mecânica interna (visibilidade de processo confidencial, DataJud+Escavador,
gatilhos de banco, etc.) fica documentado em `builder.md` — esse arquivo é o índice, não o
manual completo.

## Onde procurar antes de perguntar

- `ROADMAP-comparativo.md` / `ROADMAP-projuris.md`: gaps pesquisados vs concorrentes, o que
  foi construído, o que foi decidido segurar, o que depende de provedor pago, e o histórico
  completo de pedidos recusados por ética (captação de leads).
- `.claude/agents/qa-guardian.md`: checklist de segurança + lista completa de bugs reais já
  corrigidos (não reintroduzir) — invocar antes de mudança sensível.
- `.claude/agents/builder.md`: padrões de implementação específicos de cada feature (schema,
  RLS, mecânica interna) — a fonte de verdade pra detalhe técnico, não este arquivo.
- `.claude/agents/arquiteto.md`: o que não propor mexer sem entender o motivo primeiro
  (security definer, pares de flag que parecem redundantes mas não são).
