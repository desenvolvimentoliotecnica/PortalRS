#!/usr/bin/env bash
# Dev: apenas os 3 projetos principais — API, Portal e Next.js
# AI (RHPortal.Ai) e Integration.RM NÃO sobem (economiza ~1-3 GB de RAM).
# Uso: bash __scripts__/dev/dev-core.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck disable=SC1091
. "$SCRIPT_DIR/ports.sh"

# Libera as 3 portas usadas
for port in 5056 5051 3000 3001; do
  free_port "$port"
done

cleanup() {
  echo ""
  echo "▶ Encerrando API, Portal e Next..."
  [ -n "${API_PID:-}" ]  && kill "$API_PID"  2>/dev/null || true
  [ -n "${NEXT_PID:-}" ] && kill "$NEXT_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# --- API em background (hot reload)
echo "▶ Subindo API em background (porta 5056)..."
(
  cd "$ROOT/RHPortal.Api/RHPortal.Api"
  exec dotnet watch run
) &
API_PID=$!

# --- Next.js em background (Turbopack, sem polling)
echo "▶ Subindo Next.js em background (porta 3000)..."
(
  cd "$ROOT/LioTecnica.Web.Next"
  rm -f .next/dev/lock 2>/dev/null || true
  if [ ! -d "node_modules" ]; then
    pnpm install --silent
  fi
  # NODE_OPTIONS limita o heap do Node a 2 GB como safety net
  NODE_OPTIONS="--max-old-space-size=2048" \
  LEGACY_ORIGIN=http://localhost:5051 \
  DEV_API_ORIGIN=http://localhost:5056 \
  PORT=3000 \
  exec pnpm dev
) &
NEXT_PID=$!

# --- Aguarda API ficar pronta antes de subir o Portal
echo "▶ Aguardando API em http://localhost:5056/health (máx. 90s)..."
max=90
while [ $max -gt 0 ]; do
  if curl -sf -o /dev/null "http://localhost:5056/health" 2>/dev/null; then
    echo "▶ API pronta."
    break
  fi
  sleep 2
  max=$((max - 2))
done
[ $max -le 0 ] && echo "▶ Aviso: timeout aguardando API. Portal vai subir mesmo assim."

# Abre Next.js no browser assim que ficar pronto
(
  nmax=60
  while [ $nmax -gt 0 ]; do
    if curl -sf -o /dev/null "http://localhost:3000/app" 2>/dev/null; then
      echo "▶ Next.js pronto."
      break
    fi
    sleep 2
    nmax=$((nmax - 2))
  done
  if command -v cmd.exe &>/dev/null; then cmd.exe /c start "" "http://localhost:3000/app"
  elif command -v xdg-open &>/dev/null; then xdg-open "http://localhost:3000/app"
  elif command -v open &>/dev/null; then open "http://localhost:3000/app"
  fi
) &

# --- Portal em foreground (hot reload) — Ctrl+C encerra todos
echo "▶ Subindo Portal em foreground (porta 5051) — Ctrl+C encerra tudo..."
cd "$ROOT/LioTecnica.Web"
exec dotnet watch run
