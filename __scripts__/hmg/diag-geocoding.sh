#!/bin/bash
set -euo pipefail

echo "=== IMAGE ==="
docker inspect rhportal-api --format '{{.Config.Image}}'

echo
echo "=== EMPRESAS SEM COORDENADAS ==="
docker exec portalrh-restore-postgres psql -U portalrh_restore -d dev_render_liotecnica -c \
  "SELECT \"Description\", \"Cep\", \"Logradouro\", \"Numero\", \"Cidade\", \"Uf\", \"Latitude\" FROM \"Empresas\" WHERE \"Latitude\" IS NULL AND (trim(coalesce(\"Cep\",'')) <> '' OR trim(coalesce(\"Cidade\",'')) <> '') LIMIT 10;"

echo
echo "=== NOMINATIM (container) ==="
docker exec rhportal-api wget -qO- --timeout=15 \
  --header='User-Agent: Voltage-RenderRH/1.0 (diag)' \
  'https://nominatim.openstreetmap.org/search?q=Avenida+Paulista,+Sao+Paulo,+SP,+Brasil&format=json&limit=1&countrycodes=br' | head -c 250
echo

echo
echo "=== LOGS GEOCODING (last 50) ==="
docker logs rhportal-api 2>&1 | grep -iE 'nominatim|photon|brasilapi|geocod' | tail -50 || true

echo
echo "=== REQUEST LOGS GEOCODIFICAR ==="
docker exec portalrh-restore-postgres psql -U portalrh_restore -d dev_render_liotecnica -c \
  "SELECT \"StartedAt\", \"Path\", \"StatusCode\", \"ResponseBodySnippet\" FROM \"RequestLogs\" WHERE \"Path\" LIKE '%geocodificar%' ORDER BY \"StartedAt\" DESC LIMIT 5;" 2>/dev/null || echo "RequestLogs query failed"
