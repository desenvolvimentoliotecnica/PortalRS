# Voltage RenderRH — Regras para IAs (Codex, Cursor, Copilot)

## ⚠️ REGRA CRÍTICA: EF Core Migrations

**Toda vez que você alterar uma entidade do domínio, você DEVE criar uma migration.**

### Entidades ficam em:
```
RHPortal.Api/RHPortal.Api/Domain/Entities/
```

### Quando criar migration:
- Adicionou propriedade em qualquer entidade → **crie migration**
- Removeu propriedade → **crie migration**
- Mudou tipo, tamanho ou nullable de propriedade → **crie migration**
- Criou nova entidade → **crie migration**
- Alterou configuração no `AppDbContext.OnModelCreating` → **crie migration**

### Como criar:
```bash
cd RHPortal.Api/RHPortal.Api
dotnet ef migrations add NomeDaFeatureEmPascalCase --context AppDbContext
```

### Convenção de nome:
- `AddCampoXnaEntidadeY` — ao adicionar campo
- `RemoveCampoXdaEntidadeY` — ao remover
- `AlterCampoXnaEntidadeY` — ao modificar
- `AddTabelaX` — nova entidade/tabela

### Verificar se há pending model changes (sem criar migration):
```bash
cd RHPortal.Api/RHPortal.Api
dotnet ef migrations has-pending-model-changes --context AppDbContext
```

### ❌ NUNCA faça:
- Alterar entidade sem criar migration
- Editar `AppDbContextModelSnapshot.cs` manualmente (exceto casos documentados)
- Criar colunas via SQL puro sem também ter a migration EF correspondente
- Usar `migrationBuilder.Sql()` com `CREATE TABLE` para tabelas que existem no modelo EF

### ✅ Migration segura para cenário multi-tenant:
Todas as migrations DEVEM ser idempotentes. Se a migration adicionar coluna, use:
```csharp
migrationBuilder.Sql("""
    ALTER TABLE "Tabela" ADD COLUMN IF NOT EXISTS "Coluna" tipo NULL;
    """);
```
em vez de `migrationBuilder.AddColumn()` — porque a coluna pode já existir
em bancos de tenants mais antigos.

Ou garanta que a migration padrão do EF seja aplicada apenas em bancos novos
e que `ApplyOrphanMigrationsAsync` cubra os bancos existentes com `IF NOT EXISTS`.

---

## Arquitetura Multi-Tenant

- **Master DB**: metadados de tenants e owners (`MasterDbContext`)
- **Tenant DBs**: dados de cada empresa (`AppDbContext`) — um banco por tenant
- Cada tenant tem seu próprio banco: `dev_render_{tenantId}`

### Fluxo de migrations em produção:
1. **Deploy novo** → app sobe → `DbSeeder.MigrateAndSeedAsync` → migra master + owner + **todos os tenants existentes**
2. **Tenant novo** → `TenantProvisioningService.ProvisionTenantAsync` → cria banco + aplica todas as migrations

### Regra: toda migration nova chega automaticamente a todos os tenants no próximo deploy.

---

## Estrutura do Projeto

```
RHPortal.Api/
  RHPortal.Api/
    Domain/Entities/          ← Entidades (alterar aqui = criar migration)
    Infrastructure/Data/
      AppDbContext.cs          ← Configuração EF do tenant
      MasterDbContext.cs       ← Configuração EF do master
      DbSeeder.cs              ← Startup: migra master + owner + todos tenants
    Application/Owner/
      TenantProvisioningService.cs  ← Criação de tenant novo
    Migrations/               ← NUNCA editar manualmente (exceto snapshot sync)
    Controllers/              ← Endpoints REST
    Contracts/                ← DTOs de request/response
```

---

## Stack

- .NET 9 / ASP.NET Core
- EF Core 9 com PostgreSQL (Npgsql)
- Multi-tenant com banco separado por tenant
- Identity (UserManager / RoleManager) para autenticação
