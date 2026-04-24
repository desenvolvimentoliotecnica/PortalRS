#!/usr/bin/env bash
# Dev: API + Next.js (frontend legado descontinuado)
# Uso: bash __scripts__/dev/dev-core.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$ROOT/setup-dev.sh"

# shellcheck disable=SC1091
. "$SCRIPT_DIR/ports.sh"

# Carrega nvm se disponível
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Libera portas usadas
for port in 5056 3005 3006; do
  free_port "$port"
done

cleanup() {
  echo ""
  echo "▶ Encerrando API e Next..."
  [ -n "${API_PID:-}" ]  && kill "$API_PID"  2>/dev/null || true
  [ -n "${NEXT_PID:-}" ] && kill "$NEXT_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# --- API em background (hot reload)
echo "▶ Subindo API em background (porta 5056)..."
(
  cd "$ROOT/RHPortal.Api/RHPortal.Api"
  exec env InboxFolder__RootPath=/tmp/renderrh-inbox dotnet run
) &
API_PID=$!

# --- Next.js em background (Turbopack)
echo "▶ Subindo Next.js em background (porta 3005)..."
(
  cd "$ROOT/LioTecnica.Web.Next"
  rm -f .next/dev/lock 2>/dev/null || true
  if [ ! -d "node_modules" ]; then
    pnpm install --silent
  fi
  NODE_OPTIONS="--max-old-space-size=2048" \
  DEV_API_ORIGIN=http://localhost:5056 \
  PORT=3005 \
  exec pnpm dev
) &
NEXT_PID=$!

# --- Aguarda API ficar pronta
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
[ $max -le 0 ] && echo "▶ Aviso: timeout aguardando API. Continuando mesmo assim."

open_url() {
  if command -v xdg-open &>/dev/null; then xdg-open "$1"
  elif command -v open &>/dev/null; then open "$1"
  fi
}

echo "▶ Abrindo Swagger: http://localhost:5056/swagger"
open_url "http://localhost:5056/swagger" 2>/dev/null &

# Abre Next.js no browser assim que ficar pronto
(
  nmax=60
  while [ $nmax -gt 0 ]; do
    if curl -sf -o /dev/null "http://localhost:3005/app" 2>/dev/null; then
      echo "▶ Next.js pronto."
      break
    fi
    sleep 2
    nmax=$((nmax - 2))
  done
  open_url "http://localhost:3005/app" 2>/dev/null
) &

# --- Mantém vivo até Ctrl+C
echo "▶ Stack rodando. Ctrl+C encerra tudo."
wait
