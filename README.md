# Escritório Dashboard

Dashboard interno para escritório de advocacia. Cada perfil (Sócio, Advogado, Financeiro, Recepção) enxerga apenas as abas liberadas pelo Administrador, configuráveis em tempo real na aba **Configurações**.

## Estrutura do projeto

```
escritorio-dashboard/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx              # ponto de entrada do React
    ├── App.jsx                # componente raiz: estado de perfil/permissões e roteamento de abas
    ├── index.css               # tailwind + fontes
    ├── lib/
    │   └── theme.js            # paleta de cores (tokens de design)
    ├── config/
    │   └── permissions.js      # lista de perfis, módulos e permissões padrão
    ├── data/
    │   └── mockData.js         # dados fictícios (trocar por chamadas de API depois)
    └── components/
        ├── Sidebar.jsx         # menu lateral (mostra só as abas liberadas)
        ├── TopBar.jsx          # topo com o seletor "Visualizando como"
        ├── Card.jsx
        ├── Stamp.jsx           # selo de status (Urgente/Atenção/Em dia)
        ├── SectionTitle.jsx
        ├── EmptyState.jsx
        └── tabs/
            ├── PrazosTab.jsx
            ├── ProcessosTab.jsx
            ├── FinanceiroTab.jsx
            ├── ClientesTab.jsx
            ├── EquipeTab.jsx
            ├── ExecutivoTab.jsx
            └── ConfigTab.jsx    # só aparece para o perfil Administrador
```

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Onde ajustar cada coisa

- **Cores e tipografia** → `src/lib/theme.js` e o `@import` de fontes em `src/index.css`
- **Quais abas cada perfil vê por padrão** → `src/config/permissions.js` (`DEFAULT_PERMISSIONS`)
- **Dados exibidos (prazos, processos, financeiro, etc.)** → `src/data/mockData.js`
- **Layout de uma aba específica** → arquivo correspondente em `src/components/tabs/`

## Subindo para o GitHub pelo VS Code

O repositório já existe em `https://github.com/Leandrogbm/escritorio-dashboard` (criado com um README inicial). Para subir esses arquivos:

1. Extraia esta pasta e abra ela no VS Code.
2. No terminal integrado do VS Code (`Ctrl+\``):
   ```bash
   git init
   git remote add origin https://github.com/Leandrogbm/escritorio-dashboard.git
   git pull origin main --allow-unrelated-histories
   git add .
   git commit -m "Estrutura inicial do dashboard em componentes"
   git push origin main
   ```
3. Na primeira vez, o VS Code vai pedir para autenticar com sua conta do GitHub — use a extensão do GitHub ou o login pelo navegador que ele abrir.

Depois disso, qualquer alteração é só `git add .`, `git commit -m "..."`, `git push`.
