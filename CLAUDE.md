# Actum

SaaS multi-tenant de gestão jurídica pra escritórios de advocacia brasileiros. Cliente real
em produção: **Gimenes e Pires Sociedade de Advogados**. Nome anterior do projeto:
"mysaldo"/"Escritório Dashboard" (renomeado pra Actum — se achar referência antiga a
"mysaldo" em algum lugar, é resquício, corrigir quando encontrar).

## Stack

- **Frontend**: React 18 + Vite, Tailwind CSS. Sem router — navegação é `activeTab` (state)
  em `src/App.jsx`, cada módulo é um componente em `src/components/tabs/`.
- **Backend**: Supabase (Postgres + RLS + Auth + Edge Functions em Deno/TypeScript + Storage).
- **Deploy do frontend**: automático — `git push origin main` builda e publica sozinho no
  GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`). Domínio próprio:
  `actumjus.com.br` (Hostinger abandonado, ver "Como publicar").
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

**Hostinger foi abandonado** (conta suspensa por pagamento não renovado, set/2026) — domínio
`mysaldo.com.br` (Registro.br, mas DNS ainda apontava pro Hostinger) foi trocado pelo domínio
novo **`actumjus.com.br`** (já nativo no DNS automático do próprio Registro.br, sem depender
de mais ninguém). Deploy agora é **GitHub Pages**, 100% gratuito:

- `.github/workflows/deploy.yml` builda e publica no branch `gh-pages` a cada push em `main`
  (`peaceiris/actions-gh-pages`, usa só o `GITHUB_TOKEN` da própria Action — nenhuma
  credencial externa, nenhum FTP).
- Domínio próprio é o arquivo `public/CNAME` (conteúdo: `actumjus.com.br`) — vai junto em
  todo build automaticamente. **Se sumir, o próximo deploy volta a servir só o
  `*.github.io`** — não apagar esse arquivo sem entender que está trocando o domínio de novo.
- Settings → Pages do repo: Source = "Deploy from a branch" / `gh-pages` / `/ (root)`, custom
  domain `actumjus.com.br` — configurado uma vez, não precisa mexer de novo.
- DNS em Registro.br (domínio novo, DNS "automático" deles, editável direto no painel): 4
  registros A pro apex (`185.199.108/109/110/111.153`, IPs fixos do GitHub Pages pra
  qualquer domínio) + `CNAME www → leandrogbm.github.io`.
- **Verificar mtime rápido se alguma mudança não aparecer**: `curl -sI
  https://actumjus.com.br/ | grep -i last-modified` comparado ao hash do bundle
  (`curl -s https://actumjus.com.br/ | grep assets`) contra o que o `Build` do último
  workflow run gerou. Diferente do Hostinger (achado real: FTP "sucesso" que não gravava de
  verdade, causa nunca confirmada — suspeita de réplica atrasada do lado deles), GitHub
  Pages publicando via commit no branch não teve esse problema até agora.

**Pendência aberta da migração**: e-mail transacional (criar colaborador, redefinir senha,
portal do cliente) manda de `nao-responda@actumjus.com.br` via Resend — o domínio antigo
(`mysaldo.com.br`) tinha SPF/DKIM/DMARC verificados no Resend, o novo **ainda não**. Até
verificar `actumjus.com.br` em resend.com/domains (copiar os registros TXT que eles dão e
cadastrar no Registro.br), esses 3 e-mails têm risco real de não entregar. Confirmar isso
resolvido antes de considerar a migração 100% completa.

Fallback manual de emergência (sem depender do Actions, publica na hora):
```
npx vite build
npm i --no-save basic-ftp   # só se ainda precisar de algum FTP legado — GitHub Pages não usa
```
Pra publicar manual no `gh-pages` sem esperar o Actions: `git worktree add /tmp/gh
gh-pages`, copiar `dist/*` pra lá, commit + `git push origin gh-pages`.

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
