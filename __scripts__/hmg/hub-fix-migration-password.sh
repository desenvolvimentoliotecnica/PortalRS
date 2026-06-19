#!/usr/bin/env bash
# Repara Hub HMG quando o container cai com:
#   column h.PasswordHash does not exist
#
# Uso no servidor HMG (10.0.0.80):
#   bash __scripts__/hmg/hub-fix-migration-password.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_CONTAINER="${HUB_DB_CONTAINER:-liotecnica-hub-db}"
HUB_CONTAINER="${HUB_APP_CONTAINER:-liotecnica-hub}"
DB_NAME="${HUB_POSTGRES_DB:-liotecnica_hub}"
DB_USER="${HUB_POSTGRES_USER:-postgres}"

echo "==> Aplicando coluna PasswordHash em HubUsers..."
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  < "$SCRIPT_DIR/hub-fix-migration-password.sql"

echo "==> Reiniciando container do Hub..."
docker start "$HUB_CONTAINER" >/dev/null 2>&1 || docker restart "$HUB_CONTAINER" >/dev/null

echo "==> Aguardando /health..."
for _ in $(seq 1 25); do
  if docker exec "$HUB_CONTAINER" wget -qO- http://127.0.0.1:3010/health >/dev/null 2>&1; then
    echo "OK: Hub healthy em https://10.0.0.80:3010"
    echo "Admins podem entrar com senha local (padrão Liotec@2026 se ainda não alterada)."
    exit 0
  fi
  sleep 2
done

echo "WARN: Hub ainda não respondeu. Logs:"
docker logs "$HUB_CONTAINER" --tail 50
exit 1
