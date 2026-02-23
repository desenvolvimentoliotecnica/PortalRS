# Criar vaga por curl (teste com filtros de matching IA)

## 1. Colunas de matching (MatchingFiltrosRaw / MatchingFiltrosOriginaisRaw)

**Recomendado:** as colunas são criadas pelas migrations ao subir a API. O `DbSeeder.MigrateAndSeedAsync` aplica as migrations no banco default e em cada banco de tenant (ex.: `dev_render_liotecnica`). Garanta que a API rode pelo menos uma vez com a connection string `TenantTemplate` configurada para multi-DB, ou que os bancos de tenant existam e estejam acessíveis.

**Último recurso:** se ainda der 500 por coluna inexistente (ex.: banco restaurado sem rodar migrations), rode no PostgreSQL do banco do tenant (ex.: `dev_render_liotecnica`):

```sql
ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "MatchingFiltrosRaw" text NULL;
ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "MatchingFiltrosOriginaisRaw" text NULL;
```

## 2. Como rodar o curl

**Windows (PowerShell ou Git Bash):**

```bash
cd "c:\Users\davio\Documents\Projetos\Qualiit RenderRH\Voltage.RenderRH\RHPortal.Api\RHPortal.Api"

curl.exe -X POST "http://localhost:5056/api/vagas" ^
  -H "Content-Type: application/json" ^
  -H "X-Tenant-Id: liotecnica" ^
  -H "X-Api-Key: SUA_API_KEY" ^
  -d "@criar-vaga-body.json"
```

Substitua `SUA_API_KEY` por uma API Key válida do tenant liotecnica (Admin > Chaves API no Portal). Se usar a mesma do integrador RM, use a key que está em `Liotecnica.Integration.RM` > `appsettings` > `Portal:ApiKey`.

**Linux/Mac:**

```bash
cd Voltage.RenderRH/RHPortal.Api/RHPortal.Api
bash criar-vaga-curl.sh
```

Ou com variáveis:

```bash
export API_KEY="sua-api-key"
export BASE_URL="http://localhost:5056"
bash criar-vaga-curl.sh
```

## 3. Editar o payload

Edite `criar-vaga-body.json`:

- `titulo`: nome da vaga
- `areaId`: GUID de uma área existente (ex.: da tela Áreas ou `SELECT "Id" FROM "Areas" LIMIT 1`)
- `status`: 2 = Aberta
- `matchingFiltrosRaw`: JSON em string com critérios para o matching por IA (requisitos, keywords, resumo, etc.)

Exemplo de `matchingFiltrosRaw`:

```json
"{\"requisitos\":[\"Python\",\"SQL\"],\"keywords\":[\"backend\",\".NET\"]}"
```

## 4. Resposta esperada

- **201**: vaga criada; o corpo traz o objeto da vaga (com `id`, etc.).
- **401**: API Key inválida ou ausente.
- **409**: conflito (ex.: área inválida).
- **500**: ver item 1 (colunas no banco).
