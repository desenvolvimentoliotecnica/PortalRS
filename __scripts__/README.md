# Testes automatizados (bateria)

Este diretório contém scripts para **validar automaticamente** os principais fluxos do RenderRH sem precisar clicar em tudo manualmente.

> **Portal MVC (LioTecnica.Web) descomissionado na Fase 13** — 100% das telas estão no Next.js (`LioTecnica.Web.Next`).
> O E2E baseado em Playwright+.NET (`LioTecnica.Web.E2E`) foi removido junto. Testes end-to-end novos devem ser escritos sobre o Next (e.g. Playwright em TypeScript dentro do `LioTecnica.Web.Next`).

## 1) Bateria rápida (API + AI + Web health)

Arquivo: `test-battery.sh`

### O que valida
- **RHPortal.Ai**: health (`/health`) e (quando houver dados) matching.
- **RHPortal.Api**:
  - **Owner login** e endpoints `api/owner/*`
  - **Tenant login (admin)** e endpoints `api/*` com `X-Tenant-Id`
  - Smoke em módulos (Dashboard, Vagas, Candidatos, Talentos, etc.)
- **LioTecnica.Web.Next**:
  - `GET /app/` (SPA shell)
  - `GET /app/login` (tela de login)

### Como rodar

```bash
bash __scripts__/test-battery.sh
```

### Variáveis de ambiente (opcionais)

- **URLs**
  - `TB_API` (default: `http://localhost:5056`)
  - `TB_AI` (default: `http://localhost:8000`)
  - `TB_WEB` (default: `http://localhost:3000`) — Next.js
- **Credenciais**
  - `TB_OWNER_EMAIL`, `TB_OWNER_PASSWORD`
  - `TB_ADMIN_EMAIL`, `TB_ADMIN_EMAIL_FALLBACK`, `TB_ADMIN_PASSWORD`
- **Tenant**
  - `TB_TENANT_ID` (se não setar, o script usa o primeiro tenant retornado por `/api/owner/tenants`)

Exemplo:

```bash
export TB_TENANT_ID=dev
export TB_ADMIN_EMAIL=admin@dev.local
export TB_ADMIN_PASSWORD='ChangeThisPassword123!'
bash __scripts__/test-battery.sh
```

### Observação importante (seed)
Se o tenant estiver sem usuários, o script tenta rodar automaticamente:

- `POST /api/owner/tenants/<tenant>/seed`

Isso permite obter token admin e testar os endpoints scoped corretamente.
