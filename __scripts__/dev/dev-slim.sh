#!/usr/bin/env bash
# Dev Slim: apenas API + Next.js + AI (sem Portal e sem Integration.RM)
# Uso: bash __scripts__/dev/dev-slim.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck disable=SC1091
. "$SCRIPT_DIR/ports.sh"

for port in 5056 8000 3000 3001; do
  free_port "$port"
done

cleanup() {
  echo ""
  echo "▶ Encerrando API, AI e Next..."
  [ -n "${API_PID:-}" ]  && kill "$API_PID"  2>/dev/null || true
  [ -n "${AI_PID:-}" ]   && kill "$AI_PID"   2>/dev/null || true
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

# --- RHPortal.Ai em background
AI_DIR="$ROOT/RHPortal.Ai"
AI_PID=""
if [ -d "$AI_DIR" ]; then
  echo "▶ Subindo RHPortal.Ai em background (porta 8000)..."
  (
    cd "$AI_DIR"
    if [ ! -d ".venv" ]; then
      echo "  Criando .venv..."
      python -m venv .venv
    fi
    if [ -f ".venv/Scripts/activate" ]; then
      . .venv/Scripts/activate
    else
      . .venv/bin/activate
    fi
    pip install -q -r requirements.txt
    exec python -m app.main
  ) &
  AI_PID=$!
else
  echo "▶ RHPortal.Ai não encontrado em $AI_DIR — pulando."
fi

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
[ $max -le 0 ] && echo "▶ Aviso: timeout aguardando API."

open_url() {
  if command -v xdg-open &>/dev/null; then xdg-open "$1"
  elif command -v open &>/dev/null; then open "$1"
  elif command -v start &>/dev/null; then start "$1"
  elif command -v cmd.exe &>/dev/null; then cmd.exe /c start "" "$1"
  fi
}

echo "▶ Abrindo Swagger: http://localhost:5056/swagger"
open_url "http://localhost:5056/swagger" 2>/dev/null &

# --- Next.js em foreground (Ctrl+C encerra todos)
NEXT_DIR="$ROOT/LioTecnica.Web.Next"
echo "▶ Subindo Next.js em foreground (porta 3000) — Ctrl+C encerra tudo..."
cd "$NEXT_DIR"
rm -f .next/dev/lock 2>/dev/null || true
if [ ! -d "node_modules" ]; then
  pnpm install --silent
fi

# Abre no browser quando pronto
(
  nmax=60
  while [ $nmax -gt 0 ]; do
    if curl -sf -o /dev/null "http://localhost:3000/app" 2>/dev/null; then
      echo "▶ Next.js pronto — abrindo browser."
      break
    fi
    sleep 2
    nmax=$((nmax - 2))
  done
  open_url "http://localhost:3000/app" 2>/dev/null
) &

NODE_OPTIONS="--max-old-space-size=2048" \
DEV_API_ORIGIN=http://localhost:5056 \
PORT=3000 \
exec pnpm dev
