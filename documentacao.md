# Documentação — Voltage.RenderRH

Documentação técnica consolidada do sistema. Mantida atualizada à medida que o projeto evolui.

---

## Visão geral

Plataforma de RH com matching de candidatos assistido por IA, arquitetura **multi-tenant** com banco por tenant.

## Stack

| Camada | Tecnologia |
|---|---|
| API principal | .NET 8 + ASP.NET Core + EF Core 8 (Npgsql) |
| Frontend novo | Next.js 16 + React 19 + shadcn/ui + TailwindCSS 4 |
| Frontend legado | ASP.NET Core MVC 8 (Portal) |
| Serviço de IA | Python 3.11+ + FastAPI + LangChain + OpenAI |
| Banco | PostgreSQL 15+ com extensão `pgvector` (para embeddings) |
| Integração RM | Console app .NET (background) |
| Package managers | `pnpm@10.33.0` / `dotnet` / `pip` |

## Estrutura de pastas (alto nível)

```
Voltage.RenderRH/
├── LioTecnica.sln                 # Solução: Web MVC + Integração RM
├── LioTecnica.Web/                # Portal MVC legado (porta 5051)
├── Liotecnica.Integration.RM/     # Integração RM (console)
├── LioTecnica.Web.Next/           # Frontend Next.js novo (porta 3005 local)
├── LioTecnica.Web.E2E/            # Testes E2E Playwright
├── RHPortal.Api/
│   └── RHPortal.Api/              # API REST .NET (porta 5056)
│       ├── Domain/Entities/       # Entidades — alterar aqui exige migration
│       ├── Application/           # Use cases, serviços
│       ├── Infrastructure/
│       │   ├── Data/              # AppDbContext, MasterDbContext, DbSeeder
│       │   └── Tenancy/           # Middleware e resolução de tenant
│       ├── Controllers/           # Endpoints REST
│       └── Migrations/            # EF Core — nunca editar manualmente
├── RHPortal.Ai/                   # Serviço Python de matching (porta 8000)
└── __scripts__/dev/               # Scripts de automação de dev
```

## Princípio: Owner vs Admin do tenant

O sistema tem **dois contextos administrativos** com responsabilidades distintas:

| | **Owner** (super admin) | **Admin do tenant** |
|---|---|---|
| **Contexto** | `owner` (fora de qualquer tenant) | Tenant específico (`X-Tenant-Id` no header) |
| **Escopo** | Entitlements comerciais, onboarding, suporte | Operação do dia a dia dentro do tenant |
| **Painel** | `/app/Owner/...` | `/app/admin/...` |
| **Responsável por** | Criar/desativar tenants, habilitar módulos (entitlements), criar usuário inicial (bootstrap), recovery, migrações, acessar o tenant em modo suporte | Perfis (CRUD), menus, templates de e-mail, fila de e-mails, config SMTP/IMAP, Entra ID, idioma, logs, operação interna |

### Painel do Owner — abas do `TenantDetailScreen`

| Aba | Finalidade |
|---|---|
| **Geral** | Metadados + ações (acessar, migrar, seed, desativar) |
| **Módulos** | Liga/desliga módulos comerciais para o tenant |
| **Usuários** | Onboarding e recovery (Owner cria primeiro admin ou substitui admin perdido) |
| **Logs transacionais** | Suporte cross-tenant (requests HTTP) |
| **Logs operacionais** | Suporte cross-tenant (exceções e eventos de app) |

Todo o resto (acessos, menus, templates, e-mails, configs, idioma) fica no painel do tenant em `/app/admin/*` e é acessado pelo admin do tenant.

## Módulos por tenant (entitlements)

Camada de **controle comercial** gerenciada pelo Owner. Separa "o que o tenant contratou" de "quem faz o quê dentro do tenant".

- **Entidade**: `TenantModule` no master DB — `(TenantId, ModuleKey, IsEnabled, UpdatedAtUtc, UpdatedByOwnerId)`.
- **Catálogo**: code-first em [ModuleCatalog.cs](./RHPortal.Api/RHPortal.Api/Infrastructure/Modules/ModuleCatalog.cs). Cada módulo tem `Key`, `Name`, `Description`, `IsCore`, `PermissionKeyPrefixes`.
- **Módulos core** (nunca desativáveis): `dashboard`, `administracao`, `cadastros`, `configuracoes`.
- **Módulos opcionais**: `agenda`, `recrutamento`, `candidatos`, `matching`, `portal-vagas`, `admissao`, `feedback`, `gestao`, `relatorios`.
- **API**: `GET/PUT /api/owner/tenants/{tenantId}/modules[/<moduleKey>]` no `OwnerController`.
- **Provisionamento**: `TenantProvisioningService.ProvisionTenantAsync` chama `EnsureDefaultsAsync` (todos os módulos iniciam habilitados).
- **Efeito**: `MenuAdministrationService.ListForPermissionsAsync` filtra menus cujo `PermissionKey` mapeia para módulo desabilitado. Owner recebe tudo.
- **Gap (fase 2)**: enforcement no backend. Uma URL direta para rota de módulo desabilitado ainda responde se a role do usuário tiver a permissão. Ver backlog.
- **UI**: aba "Módulos" no painel do tenant ([TabModulos.tsx](./LioTecnica.Web.Next/src/features/owner/tenant-tabs/TabModulos.tsx)).

## Arquitetura multi-tenant

- **Master DB** (`dev_render_master`): metadados de tenants e owners. Context: `MasterDbContext`.
- **Tenant DBs** (`dev_render_{tenantId}`): dados isolados por empresa. Context: `AppDbContext`.
- **Tenant resolver**: `TenantMiddleware` lê header `X-Tenant-Id` ou query param e injeta `ITenantContext`.
- **Fluxo de migrações** (ver `CLAUDE.md` para regras detalhadas):
  1. Deploy novo → `DbSeeder.MigrateAndSeedAsync` migra master + owner + **todos os tenants existentes**.
  2. Tenant novo → `TenantProvisioningService.ProvisionTenantAsync` cria banco e aplica todas as migrações.

## Portas (ambiente local)

| Serviço | Porta |
|---|---|
| API RHPortal.Api | **5056** |
| Frontend Next.js | **3005** |
| Portal MVC legado | 5051 |
| Serviço de IA (Python) | 8000 |
| Postgres | 5432 |

## Credenciais de desenvolvimento

- **Postgres local**: user `postgres`, senha `@FelipeL89*`
- **Senha padrão dos usuários seedados**: `YkmF@2022*` (configurada em `Seed:OwnerPassword` e `Seed:AdminPassword`)

### Usuários do sistema

| Usuário | Email | Papel | Criado por |
|---|---|---|---|
| **Owner** (super admin) | `owner@dev.local` | Gerencia Owners, Tenants e provisionamento — loga fora de qualquer tenant (contexto `owner`) | `OwnerSeeder` no bootstrap da API |
| **Admin de tenant** | `admin@dev.local` (um por tenant, cada num banco diferente) | Role `Admin` — acesso total dentro do tenant | `AdminAccessSeeder` ao provisionar tenant |
| **Diretor (teste)** | `diretor@teste.local` | Superior — aprova solicitação de vaga. Role: `Admin` | `POST /api/dev/seed/usuarios-teste` (sob demanda) |
| **Gestor (teste)** | `gestor@teste.local` | Solicita vagas. Roles: `Gestor`, `Admin` | `POST /api/dev/seed/usuarios-teste` (sob demanda) |
| **RH (teste)** | `rh@teste.local` | Preenche vaga, candidatos e admissão. Roles: `Admin`, `Recrutador` | `POST /api/dev/seed/usuarios-teste` (sob demanda) |

### Como trocar senhas

1. Atualizar `Seed:OwnerPassword` e `Seed:AdminPassword` no `appsettings.Development.json`.
2. Para aplicar aos usuários **já existentes**, dropar os bancos (`DROP DATABASE dev_render_master, dev_render, dev_render_*`) e reiniciar a API — os seeders recriam tudo.
3. Alternativa programática: `OwnerSeeder.UpdatePasswordAsync` (owner) ou `UserManager.RemovePasswordAsync` + `AddPasswordAsync` (usuários Identity).
4. A senha dos usuários de teste é hardcoded em [DevSeedController.cs](./RHPortal.Api/RHPortal.Api/Controllers/DevSeedController.cs) — `const string senha`.

## Scripts de desenvolvimento (`__scripts__/dev/`)

| Script | O que faz |
|---|---|
| `dev-core.sh` | Sobe API (5056) + Next.js (3005) — fluxo recomendado no dia-a-dia |
| `dev-all.sh` | Sobe tudo: API + Portal MVC + Next + Python AI + Integração RM |
| `dev-api.sh` | Só a API .NET |
| `dev-next.sh` | Só o Next.js |
| `dev-portal.sh` | Só o Portal MVC |
| `fix-broken-migrations.sh` | Corrige migration `20260411055438_AddUnidadeLotacaoHierarchyV2` quando conflita |
| `ports.sh` | Utilitário para liberar portas |

## Endpoints úteis

- **Swagger**: `http://localhost:5056/swagger`
- **Health check**: `http://localhost:5056/health` (retorna `{ status, checks: [database_master, database] }`)
- **Frontend**: `http://localhost:3005/app`

## Logs no painel do Owner (compatibilidade de rotas)

As abas do Owner em `TenantDetailScreen` consomem rotas proxy em `/api/owner/tenants/{tenantId}/config/*`.
Para evitar erro de UI "Erro ao carregar logs", a API expõe:

- **Transacionais**
  - `GET /api/owner/tenants/{tenantId}/config/logs/transactions`
  - `GET /api/owner/tenants/{tenantId}/config/logs/transactions/{id}`
  - `GET /api/owner/tenants/{tenantId}/config/logs/summary`
- **Operacionais**
  - `GET /api/owner/tenants/{tenantId}/config/operational-logs/requests`
  - `GET /api/owner/tenants/{tenantId}/config/operational-logs/requests/{id}`
  - `GET /api/owner/tenants/{tenantId}/config/operational-logs/summary`

### Regras de execução desses endpoints

- Validam o `tenantId` e conferem existência no `MasterDbContext`
- Criam escopo e aplicam `ITenantContext.SetTenantId(tenantId)`
- Leem dados do `AppDbContext` do tenant e retornam contratos de `Audit`/`Logging`
- Sem autenticação/permissão retornam `401/403` (comportamento esperado de segurança)

## Arquivos de configuração

| Arquivo | Conteúdo |
|---|---|
| `RHPortal.Api/RHPortal.Api/appsettings.Development.json` | ConnectionStrings, Seed, Jwt, Cors, InboxFolder, RhAi, SlaVaga, Ai.OpenAI |
| `LioTecnica.Web/appsettings.Development.json` | Endpoints (RhApi URL), NextFrontend, EntraId |
| `Liotecnica.Integration.RM/appsettings.Development.json` | Portal (BaseUrl, TenantId, ApiKey), AiService |
| `RHPortal.Ai/.env` | DATABASE_URL, TENANT_DATABASE_TEMPLATE, OPENAI_API_KEY |
| `.env` (raiz) | Variáveis para `docker compose` (produção) |

## CORS

Configurado em `RHPortal.Api/RHPortal.Api/Program.cs:153`:
- Lê `Cors:AllowAny` (bool) e `Cors:WebOrigin` (csv de origens).
- Se `AllowAny=true` → `AllowAnyOrigin`; senão → `WithOrigins(lista).AllowCredentials()`.
- Dev atual: `http://localhost:5051,http://localhost:3005`.

## Problemas conhecidos

| Sintoma | Solução |
|---|---|
| API não sobe com erro `relação "X" já existe` | `bash __scripts__/dev/fix-broken-migrations.sh` |
| Next.js: `Can't resolve '<pacote>/css/styles.css'` | `cd LioTecnica.Web.Next && pnpm install` |
| Next.js com erros após `git pull` | `rm -rf .next && pnpm dev` |
| Portas ocupadas (5056/3005) | `bash __scripts__/dev/ports.sh` |

## Pré-requisitos da máquina

- .NET 8 SDK (runtime 8.0.x)
- Node.js 20 LTS + pnpm 10.33.0+ (via corepack/nvm)
- Python 3.11+ (apenas para `RHPortal.Ai`)
- PostgreSQL 15+ rodando em `localhost:5432`
- `dotnet-ef` global (`dotnet tool install -g dotnet-ef`)

## Documentos relacionados

- [CLAUDE.md](./CLAUDE.md) — Regras de EF Core / Migrations (crítico)
- [agent.md](./agent.md) — Orientações para IAs
- [habilidades.md](./habilidades.md) — Conhecimentos reutilizáveis sobre o projeto
- [knowledge-base/visao-arquitetural.md](./knowledge-base/visao-arquitetural.md) — **Visão TO-BE** consolidada com o arquiteto (pacotes comerciais, módulos, core, conceitos de domínio novos e gap vs sistema atual)
- [knowledge-base/sidebar-blocos-e-abas.md](./knowledge-base/sidebar-blocos-e-abas.md) — Mapa funcional completo da sidebar do tenant (blocos, abas e finalidade)
- [knowledge-base/handoff-claude-code-2026-04-17.md](./knowledge-base/handoff-claude-code-2026-04-17.md) — Pacote de retomada para Claude Code (estado atual, prioridades e regras)
- [backlog.md](./backlog.md) — Tarefas
- [changelog.md](./changelog.md) — Histórico de mudanças
- [diario-de-bordo.md](./diario-de-bordo.md) — Log de interações
