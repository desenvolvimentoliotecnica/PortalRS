#!/usr/bin/env bash
# Corrige /Login HTTP 500 quando o client secret Entra foi criptografado
# com chaves DataProtection de um container anterior (redeploy sem volume dpkeys).
#
# Uso no servidor HMG (10.0.0.80):
#   cd ~/liotecnica-hub-hmg
#   bash ~/rhportal-hmg/__scripts__/hmg/hub-fix-login-500.sh
#   # ou copie o script manualmente

set -euo pipefail

DB_CONTAINER="${HUB_DB_CONTAINER:-liotecnica-hub-db}"
HUB_CONTAINER="${HUB_APP_CONTAINER:-liotecnica-hub}"
DB_NAME="${HUB_POSTGRES_DB:-liotecnica_hub}"
DB_USER="${HUB_POSTGRES_USER:-postgres}"

echo "==> Verificando containers..."
docker ps --format '{{.Names}}' | grep -E "^(${DB_CONTAINER}|${HUB_CONTAINER})$" || {
  echo "Containers hub não encontrados. Ajuste HUB_DB_CONTAINER / HUB_APP_CONTAINER."
  exit 1
}

echo "==> Limpando client secret criptografado inválido..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
  'UPDATE "HubEntraConfigs" SET "ClientSecretProtected" = NULL WHERE "ClientSecretProtected" IS NOT NULL;'

echo "==> Reiniciando hub..."
docker restart "$HUB_CONTAINER" >/dev/null

echo "==> Aguardando health..."
for _ in $(seq 1 20); do
  if docker exec "$HUB_CONTAINER" wget -qO- http://127.0.0.1:3010/health >/dev/null 2>&1; then
    echo "OK: Hub healthy."
    echo "Acesse https://10.0.0.80:3010/Login e reconfigure o client secret no Admin se Entra estiver habilitado."
    exit 0
  fi
  sleep 2
done

echo "WARN: Hub ainda não respondeu /health. Verifique: docker logs $HUB_CONTAINER --tail 80"
exit 1
