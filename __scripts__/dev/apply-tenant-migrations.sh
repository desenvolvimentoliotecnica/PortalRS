#!/usr/bin/env bash
# Aplica migrações EF no banco de um tenant específico (ex.: liotecnica -> dev_render_liotecnica).
# Uso: ./apply-tenant-migrations.sh <tenantId>
# Requer: dotnet ef, appsettings.Development.json com TenantTemplate ou Default.
set -e
if [ -z "$1" ]; then
  echo "Uso: $0 <tenantId>   (ex.: $0 liotecnica)"
  exit 1
fi
TENANT_ID="$1"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_DIR="$ROOT/RHPortal.Api/RHPortal.Api"
# Monta connection string do tenant (mesmo padrão do TenantTemplate)
CONN="Host=localhost;Port=5432;Database=dev_render_${TENANT_ID};Username=victoralves;Password="
echo "▶ Aplicando migrações no tenant: $TENANT_ID (Database=dev_render_${TENANT_ID})"
cd "$API_DIR"
dotnet ef database update --context AppDbContext --connection "$CONN" --no-build 2>&1 || dotnet ef database update --context AppDbContext --connection "$CONN" 2>&1
echo "▶ Pronto."
