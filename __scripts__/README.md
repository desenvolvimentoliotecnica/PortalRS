# Testes automatizados (bateria + E2E)

Este diretório contém scripts para **validar automaticamente** os principais fluxos do RenderRH sem precisar clicar em tudo manualmente.

## 1) Bateria rápida (API + AI + Web health)

Arquivo: `test-battery.sh`

### O que valida
- **RHPortal.Ai**: health (`/health`) e (quando houver dados) matching.
- **RHPortal.Api**:
  - **Owner login** e endpoints `api/owner/*`
  - **Tenant login (admin)** e endpoints `api/*` com `X-Tenant-Id`
  - Smoke em módulos (Dashboard, Vagas, Candidatos, Talentos, etc.)
- **LioTecnica.Web**:
  - `GET /Account/Login`
  - `GET /api/health`

### Como rodar

```bash
bash __scripts__/test-battery.sh
```

### Variáveis de ambiente (opcionais)

- **URLs**
  - `TB_API` (default: `http://localhost:5056`)
  - `TB_AI` (default: `http://localhost:8000`)
  - `TB_WEB` (default: `http://localhost:5064`)
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

## 2) E2E Web (Playwright em .NET)

Projeto: `../LioTecnica.Web.E2E/`

### Instalar browsers do Playwright (uma vez por máquina)

No Windows (PowerShell):

```powershell
dotnet build .\LioTecnica.Web.E2E\LioTecnica.Web.E2E.csproj
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\LioTecnica.Web.E2E\bin\Debug\net8.0\playwright.ps1 install chromium
```

### Rodar os testes E2E

```bash
dotnet test Voltage.RenderRH/LioTecnica.Web.E2E/LioTecnica.Web.E2E.csproj
```

Variáveis (opcionais):
- `E2E_WEB_BASEURL` (default: `http://localhost:5064`)
- `E2E_TENANT_ID` (default: `dev`)
- `E2E_EMAIL` (default: `admin@dev.local`)
- `E2E_PASSWORD` (default: `ChangeThisPassword123!`)
- `E2E_HEADLESS` (default: `true`)
- `E2E_FAIL_ON_CONSOLE_ERROR` (default: `true`)

