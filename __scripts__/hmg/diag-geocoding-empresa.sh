#!/bin/bash
set -euo pipefail

ID='f4ed24ef-dc43-4ab9-90e0-8eb9bb8f94c3'

echo "=== EMPRESA ALVO ==="
docker exec portalrh-restore-postgres psql -U portalrh_restore -d dev_render_liotecnica -c \
  "SELECT \"Id\", \"Description\", \"Cep\", \"Logradouro\", \"Numero\", \"Bairro\", \"Cidade\", \"Uf\", \"Latitude\", \"Longitude\" FROM \"Empresas\" WHERE \"Id\" = '$ID';"

echo
echo "=== NOMINATIM: endereco Liotecnica Embu ==="
docker exec rhportal-api wget -qO- --timeout=15 \
  --header='User-Agent: Voltage-RenderRH/1.0 (diag)' \
  'https://nominatim.openstreetmap.org/search?q=JOAO+PAULO+I,+900,+Embu+das+Artes,+SP,+06818-901,+Brasil&format=json&limit=1&countrycodes=br' | head -c 400
echo

echo
echo "=== PHOTON ==="
docker exec rhportal-api wget -qO- --timeout=15 \
  'https://photon.komoot.io/api/?q=JOAO+PAULO+I+900,+Embu+das+Artes,+SP,+06818-901,+Brasil&limit=1&lang=pt' | head -c 400
echo

echo
echo "=== BRASILAPI v2 CEP 06818901 ==="
docker exec rhportal-api wget -qO- --timeout=15 \
  'https://brasilapi.com.br/api/cep/v2/06818901' | head -c 500
echo

echo
echo "=== NOMINATIM: so cidade+cep ==="
docker exec rhportal-api wget -qO- --timeout=15 \
  --header='User-Agent: Voltage-RenderRH/1.0 (diag)' \
  'https://nominatim.openstreetmap.org/search?q=Embu+das+Artes,+SP,+06818-901,+Brasil&format=json&limit=1&countrycodes=br' | head -c 400
echo

echo
echo "=== LOG ENTRIES geocoding today ==="
docker exec portalrh-restore-postgres psql -U portalrh_restore -d dev_render_liotecnica -c \
  "SELECT \"OccurredAt\", \"Level\", \"Message\" FROM \"LogEntries\" WHERE \"Message\" ILIKE '%nominatim%' OR \"Message\" ILIKE '%photon%' OR \"Message\" ILIKE '%brasilapi%' OR \"Message\" ILIKE '%Geocod%' ORDER BY \"OccurredAt\" DESC LIMIT 15;"
