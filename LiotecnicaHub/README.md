# Liotecnica Hub

Launcher corporativo **Liotecnica Hub** — portal único de entrada para aplicativos internos (Portal RH e outros), com autenticação **Microsoft Entra ID** e painel administrativo.

## Arquitetura

```
LiotecnicaHub.Web/
├── Domain/Entities/          # HubApplication, HubUser, HubProfile, HubSystem, HubPermission, ...
├── Domain/Enums/             # Ambiente (Dev/Hml/Prd), regras de acesso
├── Infrastructure/Data/      # HubDbContext, HubDbSeeder
├── Infrastructure/Security/  # DataProtection para client secret
├── Infrastructure/Authorization/  # Policy HubAdmin
├── Application/Authentication/    # OAuth manual (challenge/callback)
├── Application/Applications/    # Catálogo e visibilidade por usuário
├── Application/Access/          # Catálogo IAM (Fase 1)
└── Pages/                    # Razor Pages (Login, Apps, Admin)
```

### Fluxo de autenticação

1. Usuário acessa `/Login` e clica em **Entrar com Microsoft**
2. `EntraChallengeService` redireciona ao Entra com `state` assinado (HMAC)
3. Callback em `/Auth/EntraCallback` troca `code` por `id_token`
4. `EntraTokenValidator` valida o token contra o OpenID metadata do tenant
5. `HubAuthService` emite cookie `.LiotecnicaHub.Auth` (8h, sliding)

Configuração Entra (tenant, client id, secret, redirect) fica em **`HubEntraConfig`** no PostgreSQL. O client secret é protegido com **IDataProtection**.

### Autorização

| Área | Requisito |
|------|-----------|
| `/Apps` | Usuário autenticado |
| `/Admin` | Policy `HubAdmin` — e-mail na tabela `HubAdmins` |

### Controle de acessos (Fase 1)

Catálogo IAM centralizado: sistemas, módulos, permissões (`portalrh.vagas.criar`), perfis e escopos.

- Validação: **Admin → Controle de Acessos** (`/Admin/Access`)
- Roadmap: `docs/HUB-CONTROLE-ACESSOS-ROADMAP.md`
- Migration Postgres: `AddControleAcessosFase1`
- Dev SQLite: após mudança de schema, apague `App_Data/liotecnica_hub.db` e suba de novo

### Banco de dados

- PostgreSQL único (não multi-tenant)
- Migrations EF Core em `Migrations/`
- Seed na subida: 3 apps Portal RH, config Entra padrão, admins via env

## Desenvolvimento local (sem Docker)

### Pré-requisitos

- **.NET 8 SDK** apenas — em Development o hub usa **SQLite** (`App_Data/liotecnica_hub.db`). **Não precisa de Docker** nem PostgreSQL local.

### Passo a passo (Windows)

```bat
cd D:\Projetos\PortalRH\RH-devops-Lucas\LiotecnicaHub\LiotecnicaHub.Web
dotnet run --launch-profile http
```

Ou, na raiz do repo:

```bat
scripts\subir-hub-local.bat
```

Abra **http://localhost:3010** no navegador.

O perfil `http` em `Properties/launchSettings.json` já define `ASPNETCORE_ENVIRONMENT=Development`.

> **Erro `28P01 autenticação falhou para postgres`?**  
> Você rodou sem `Development` (usou Postgres de `appsettings.json`). Use `dotnet run --launch-profile http` ou `set ASPNETCORE_ENVIRONMENT=Development`.

### Docker (opcional — deploy / HMG)

Docker **não é obrigatório** para dev. Use apenas para subir stack completa (Hub + PostgreSQL) como em homologação:

```bat
cd D:\Projetos\PortalRH\RH-devops-Lucas
docker compose -f docker-compose.hub.yml up -d --build
```

Requer [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado.

### Migrations

```bash
cd LiotecnicaHub/LiotecnicaHub.Web
dotnet ef migrations add NomeDaAlteracao
dotnet ef database update
```

## Docker

Na raiz do repositório:

```bash
docker compose -f docker-compose.hub.yml up -d --build
```

Imagem: `LiotecnicaHub/Dockerfile` — porta **3010**.

## Documentação de deploy

Ver [docs/HUB-DEPLOY.md](../docs/HUB-DEPLOY.md) para Azure AD, variáveis de ambiente e deploy HMG.

## Stack

- ASP.NET Core 8 Razor Pages
- EF Core 8 + Npgsql
- Cookie Authentication
- Microsoft Identity Model (validação id_token)
- Health check `/health`
