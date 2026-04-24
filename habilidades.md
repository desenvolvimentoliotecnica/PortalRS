# Habilidades — conhecimentos reutilizáveis sobre este projeto

Reúne "skills" que qualquer IA (ou dev humano) precisa saber para trabalhar bem no `Voltage.RenderRH`. Complementa [documentacao.md](./documentacao.md) e [CLAUDE.md](./CLAUDE.md).

---

## 1. Setup local do ambiente

### 1.1 Pré-requisitos

- **.NET 8 SDK** (runtime 8.0.x) — o projeto alvo `net8.0`; .NET 10 sozinho não roda
- **Node.js 20 LTS + pnpm 10.33+** (via nvm e corepack)
- **PostgreSQL 15+** em `localhost:5432`
- **Python 3.11+** (apenas para `RHPortal.Ai`)
- `dotnet-ef` global: `dotnet tool install -g dotnet-ef`

### 1.2 Credenciais do Postgres local

- User: `postgres`
- Senha: `@FelipeL89*`

### 1.3 Connection strings

Em `RHPortal.Api/RHPortal.Api/appsettings.Development.json`:
- `Default` → `dev_render` (owner/system)
- `Master` → `dev_render_master` (metadados de tenants)
- `TenantTemplate` → `dev_render_{0}` (banco por tenant)

### 1.4 Subir o stack

```bash
bash __scripts__/dev/dev-core.sh   # API (5056) + Next.js (3005)
```

---

## 2. Portas

| Serviço | Porta |
|---|---|
| API RHPortal.Api | 5056 |
| Next.js | **3005** (era 3000 — alterada em 2026-04-16 por conflito local) |
| Portal MVC legado | 5051 |
| Python AI | 8000 |
| Postgres | 5432 |

**Locais com hardcode da porta do frontend:** se alterar a porta, revisar:
- `__scripts__/dev/dev-core.sh` (var PORT)
- `__scripts__/dev/dev-core.ps1`, `dev-all.sh` (outros scripts)
- `RHPortal.Api/RHPortal.Api/appsettings.Development.json` (`Cors.WebOrigin`)
- `RHPortal.Api/RHPortal.Api/Application/PreAdmissao/PreAdmissaoService.cs:616` (URL pública do fluxo de admissão)
- `RHPortal.Api/RHPortal.Api/Controllers/DevSeedController.cs:168` (URL do próximo passo do seed de teste)

---

## 3. Usuários e autenticação

### 3.1 Owner (super admin, master DB)

- Email: `owner@dev.local`
- Senha: configurável em `Seed:OwnerPassword` (fallback `Seed:AdminPassword`)
- Função: gerencia Owners, Tenants e provisionamento — **loga fora de qualquer tenant**
- Criado automaticamente por `OwnerSeeder` no bootstrap da API

### 3.2 Admin de tenant (1 por tenant)

- Email: `admin@dev.local` (dentro do banco de cada tenant — IDs diferentes)
- Senha: configurável em `Seed:AdminPassword`
- Role: `Admin` (full access dentro do tenant) + role `Administrador` é garantida (role separada)
- Criado pelo `AdminAccessSeeder` quando um tenant é provisionado

### 3.3 Usuários de teste (opcional, sob demanda)

Criados pelo endpoint `POST /api/dev/seed/usuarios-teste` (dev only). Senha hardcoded no `DevSeedController.cs`.

| Email | Papel | Roles atribuídas |
|---|---|---|
| `diretor@teste.local` | Superior/aprovador de vagas | Admin |
| `gestor@teste.local` | Solicita vagas | Gestor, Admin |
| `rh@teste.local` | Preenche vaga, candidatos, conduz processo | Admin, Recrutador |

### 3.4 Trocar senha

- **PasswordHasher do ASP.NET Identity** (não é hash trivial). Para resetar senhas:
  1. Atualizar valores em `Seed` do `appsettings.Development.json`
  2. Dropar os bancos (`dev_render_master`, `dev_render`, `dev_render_*`) se ainda não houver dados preciosos
  3. Resubir a API — os seeders recriam com a nova senha
- `OwnerSeeder.UpdatePasswordAsync` (método existente) permite reset programático do Owner no master.
- Para `ApplicationUser`: usar `UserManager.RemovePasswordAsync` + `AddPasswordAsync` ou `GeneratePasswordResetTokenAsync` + `ResetPasswordAsync`.

---

## 4. Roles no tenant

Roles semeadas no tenant (via `AdminAccessSeeder` e `MenuRoleSeeder`):

- `Admin` — acesso total, atribuída ao usuário admin padrão
- `Administrador` — admin escopado ao tenant (pode assumir processos)
- `Gestor` — usado em atribuição de usuários de teste
- `Recrutador` — usado em atribuição de usuários de teste
- Outras roles podem ser definidas em `MenuRoleSeeder` e no `MenuSeeder`

---

## 5. Multi-tenant: como funciona

- **Master DB** (`dev_render_master`): metadados (Tenants, Owners). Context: `MasterDbContext`.
- **Tenant DB** (`dev_render_{tenantId}`): dados do tenant. Context: `AppDbContext`.
- **Resolução de tenant**: middleware `TenantMiddleware` lê `X-Tenant-Id` (header) ou query. Se ausente e o usuário for Owner, roda no contexto `owner` (banco `dev_render`).
- **Novo tenant**: `POST /api/owner/tenants` → `TenantProvisioningService.ProvisionTenantAsync` cria o banco `dev_render_{tenantId}` e roda todas as migrações + seeders.

---

## 6. Migrations

> **Regra crítica:** ver [CLAUDE.md](./CLAUDE.md) para o contrato completo.

- Entidades em `RHPortal.Api/RHPortal.Api/Domain/Entities/`
- Qualquer alteração em entidade exige `dotnet ef migrations add <Nome>` com `--context AppDbContext`
- Migrations devem ser **idempotentes** (uso de `IF NOT EXISTS`) por causa do multi-tenant
- No startup, `DbSeeder.MigrateAndSeedAsync` migra master + owner + todos os tenants
- Migration conhecidamente corrompida: `20260411055438_AddUnidadeLotacaoHierarchyV2` → corrigir com `bash __scripts__/dev/fix-broken-migrations.sh`

---

## 7. CORS

Configurado em `RHPortal.Api/RHPortal.Api/Program.cs:153`:
- Lê `Cors:AllowAny` (bool) e `Cors:WebOrigin` (CSV de origens)
- Dev atual: `http://localhost:5051,http://localhost:3005`

---

## 8. Comandos úteis

```bash
# subir tudo
bash __scripts__/dev/dev-core.sh

# liberar portas ocupadas
bash __scripts__/dev/ports.sh

# migration nova
cd RHPortal.Api/RHPortal.Api
dotnet ef migrations add NomeDaMigration --context AppDbContext

# verificar pending model changes
dotnet ef migrations has-pending-model-changes --context AppDbContext

# reset do Next.js após git pull
cd LioTecnica.Web.Next && rm -rf .next && pnpm install && pnpm dev

# inspecionar banco
PGPASSWORD='@FelipeL89*' psql -h localhost -U postgres -d dev_render_master
```

---

## 9. Convenções do repositório

- **Arquivos de tracking obrigatórios**: `diario-de-bordo.md`, `backlog.md`, `changelog.md`, `documentacao.md`, `habilidades.md` (este). Atualizar a cada intervenção — regra detalhada em [agent.md](./agent.md).
- **Idioma**: português para docs e commits descritivos; código em inglês onde já está.
- **Datas**: ISO `YYYY-MM-DD`.

---

## 10. Troubleshooting rápido (Owner Logs)

### Sintoma

- No painel do Owner, abas `Logs transacionais` e `Logs operacionais` exibem "Erro ao carregar logs".

### Diagnóstico padrão

- Verificar se o backend responde os proxies:
  - `/api/owner/tenants/{tenantId}/config/logs/transactions`
  - `/api/owner/tenants/{tenantId}/config/operational-logs/requests`
- Se retornar `404`, há descompasso de rotas.
- Se retornar `401/403`, rota existe e o problema é autenticação/permissão/token.

### Comando de verificação rápida

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5056/api/owner/tenants/liotecnica/config/logs/transactions"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5056/api/owner/tenants/liotecnica/config/operational-logs/requests"
```
