## Portal RH (Next.js) — scaffold para migração incremental

Este projeto é o **novo frontend** em Next.js, criado para rodar **em paralelo** ao legado **ASP.NET Core MVC/Razor**.

- **Objetivo**: migrar **rota a rota** sem big bang, com rollback simples.
- **Path reservado**: o Next roda sob **`/app/*`** (via `basePath`), evitando colisões com rotas MVC.
- **Auth/BFF**: por enquanto, o legado continua sendo a fonte de verdade de login/cookies. O Next consome `/bff/*` via SSR.

## Rodando localmente

### Pré-requisitos

- **Node.js** 20+
- **pnpm**

### Somente Next (sem legado)

```bash
pnpm dev
```

Abra `http://localhost:3000/app`.

### Integrado com API/BFF (recomendado)

Defina os origins de API e BFF no dev:

```bash
DEV_API_ORIGIN=http://localhost:5056 DEV_BFF_ORIGIN=http://localhost:5051 pnpm dev
```

Compatibilidade: `LEGACY_ORIGIN` ainda pode ser usado como fallback para `DEV_BFF_ORIGIN`.

Com isso, o Next consegue consumir:
- `/api/*` e `/health` via `DEV_API_ORIGIN`
- `/bff/*` via `DEV_BFF_ORIGIN`

## Estrutura (alto nível)

- `src/app/(app)/*`: rotas do app sob `/app/*` (ex.: `/app/dashboard`)
- `src/components/layout/*`: shell (sidebar/topbar) e navegação
- `src/server/bff/*`: client server-only para chamar o legado com cookies (SSR)
- `src/styles/theme.css`: tokens com as cores do legado (`--lt-*`)

## Scripts

- `pnpm dev`: dev server
- `pnpm build`: build de produção
- `pnpm lint`: ESLint
- `pnpm format` / `pnpm format:check`: Prettier
- `pnpm test:e2e`: Playwright (smoke tests)

## Deploy (paralelo por path)

Em produção, o padrão mais seguro é um reverse proxy roteando:

- `/app/*` → Next.js
- `/api/*` e `/health` → RHPortal.Api
- `/bff/*` (enquanto necessário) → legado ASP.NET
- todo o resto → ASP.NET MVC (legado)

Rollback é simplesmente desfazer o roteamento do `/app/*`.

## Links úteis

- Next.js Docs: `https://nextjs.org/docs`
- shadcn/ui: `https://ui.shadcn.com/`
