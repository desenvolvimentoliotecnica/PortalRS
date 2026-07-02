#!/usr/bin/env bash
# Falha o deploy se o Portal Admin (nginx :3000) não responder /health.
set -euo pipefail

WEB_NEXT_HEALTH_URL="${WEB_NEXT_HEALTH_URL:-http://127.0.0.1:3000/health}"
WEB_NEXT_CONTAINER="${WEB_NEXT_CONTAINER:?defina WEB_NEXT_CONTAINER}"
WEB_NEXT_WAIT_ATTEMPTS="${WEB_NEXT_WAIT_ATTEMPTS:-45}"

attempt=0
while (( attempt < WEB_NEXT_WAIT_ATTEMPTS )); do
  if curl -fsS "$WEB_NEXT_HEALTH_URL" >/dev/null 2>&1; then
    if curl -fsS "http://127.0.0.1:3000/api/health" 2>/dev/null | grep -qi healthy; then
      echo "OK: Portal Admin responde em $WEB_NEXT_HEALTH_URL e proxy /api/health OK"
      exit 0
    fi
    echo "WARN: $WEB_NEXT_HEALTH_URL OK mas /api/health ainda falha (tentativa $((attempt + 1))/$WEB_NEXT_WAIT_ATTEMPTS)"
  fi
  attempt=$((attempt + 1))
  sleep 2
done

echo "ERRO: Portal Admin não responde em $WEB_NEXT_HEALTH_URL após $((WEB_NEXT_WAIT_ATTEMPTS * 2))s" >&2
echo "=== docker logs $WEB_NEXT_CONTAINER (últimas 50 linhas) ===" >&2
docker logs "$WEB_NEXT_CONTAINER" --tail 50 2>&1 >&2 || true
exit 1
