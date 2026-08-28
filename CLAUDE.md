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

```
npx vite build
powershell -Command "Compress-Archive -Path dist\* -DestinationPath actum-build.zip -Force"
git add -A
git commit -m "..."
git push origin main
```
**O usuário sobe o zip manualmente no Hostinger** — isso já foi confundido com "bug" mais de
uma vez (feature simplesmente não tinha sido publicada ainda). Sempre lembrar disso no fim de
qualquer entrega de frontend.

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
