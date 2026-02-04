#!/usr/bin/env bash
# Aplica migrações EF em todos os bancos de tenants (dev: liotecnica, dev, qualiit).
# Uso: ./apply-all-tenant-migrations.sh [tenantId1 tenantId2 ...]
# Se não passar tenant IDs, usa a lista padrão: liotecnica dev qualiit
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_DIR="$ROOT/RHPortal.Api/RHPortal.Api"
APPLY_ONE="$ROOT/__scripts__/dev/apply-tenant-migrations.sh"

if [ ! -f "$APPLY_ONE" ]; then
  echo "Script por tenant não encontrado: $APPLY_ONE"
  exit 1
fi

if [ $# -eq 0 ]; then
  TENANTS=(liotecnica dev qualiit)
  echo "▶ Nenhum tenant informado. Usando lista padrão: ${TENANTS[*]}"
else
  TENANTS=("$@")
  echo "▶ Tenants informados: ${TENANTS[*]}"
fi

for t in "${TENANTS[@]}"; do
  echo ""
  "$APPLY_ONE" "$t" || { echo "▶ Falha no tenant: $t"; exit 1; }
done
echo ""
echo "▶ Migrações aplicadas em todos os tenants."
