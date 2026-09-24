# Actum

SaaS multi-tenant de gestão jurídica para escritórios de advocacia — clientes, processos,
prazos, quadro de tarefas, financeiro/ERP, equipe e portal do cliente.
Em produção em [actumjus.com.br](https://actumjus.com.br).

## Stack

React 18 + Vite + Tailwind no frontend; Supabase (Postgres + RLS, Auth, Edge Functions em
Deno, Storage) no backend.

## Rodar localmente

```bash
npm install
cp .env.example .env   # preencher as chaves VITE_*
npm run dev            # http://localhost:5173
```

## Estrutura

```
src/
  App.jsx              navegação por abas (activeTab), sem router
  components/          telas compartilhadas, modais, landing
  components/tabs/     um componente por módulo (Clientes, Processos, Prazos…)
  config/ hooks/ lib/  permissões, planos, hooks do Supabase, helpers
supabase/
  schema.sql           provisiona o banco do zero (fonte da verdade)
  migrations/          histórico de mudanças aplicadas
  functions/           Edge Functions
public/                assets servidos no site (ícones, CNAME do domínio)
docs/                  roadmaps e arquivos de marca que não vão pro site
```

## Deploy

`git push origin main` builda e publica sozinho no GitHub Pages
(`.github/workflows/deploy.yml`). Detalhes, convenções e regras do projeto: `CLAUDE.md`.
