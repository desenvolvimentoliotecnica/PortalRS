#!/usr/bin/env bash
# Criar vaga com filtros de matching por IA (teste direto na API)
# Requer: API rodando em http://localhost:5056 e uma API Key válida do tenant liotecnica.

BASE_URL="${BASE_URL:-http://localhost:5056}"
TENANT_ID="${TENANT_ID:-liotecnica}"
API_KEY="${API_KEY:-Yv62-R5-7wbC5ycAA69TVHW-SansTUUQkVULDQ1IV5I}"

curl -s -w "\n\nHTTP_STATUS:%{http_code}\n" -X POST "${BASE_URL}/api/vagas" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: ${TENANT_ID}" \
  -H "X-Api-Key: ${API_KEY}" \
  -d @"$(dirname "$0")/criar-vaga-body.json"
