#!/usr/bin/env bash
# RH Portal — sobe API e Portal em paralelo com hot reload.
# Use um único terminal: API em background, Portal em foreground. Ctrl+C encerra os dois.
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Derruba as portas antes de subir (5056 = API, 5051 = Portal)
# Mata também o processo pai (dotnet watch) para não ressuscitar e ocupar a porta
for port in 5056 5051; do
  p=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  [ -z "$p" ] && p=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -n "$p" ]; then
    echo "▶ Liberando porta $port (PID $p) e pais (dotnet watch)..."
    for pid in $p; do
      ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
      [ -n "$ppid" ] && [ "$ppid" -gt 1 ] && kill -9 "$ppid" 2>/dev/null || true
    done
    echo "$p" | xargs kill -9 2>/dev/null || true
  fi
done
sleep 2

cleanup() {
  echo ""
  echo "▶ Encerrando API e Portal..."
  kill "$API_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "▶ Subindo API em background..."
"$SCRIPT_DIR/dev-api.sh" &
API_PID=$!

# Espera a API ficar pronta (health em localhost:5056) antes de subir o Portal
echo "▶ Aguardando API em http://localhost:5056 (máx. 90s)..."
max=90
url="http://localhost:5056/health"
while [ $max -gt 0 ]; do
  if curl -sf -o /dev/null "$url" 2>/dev/null; then
    echo "▶ API pronta."
    break
  fi
  sleep 2
  max=$((max - 2))
done
if [ $max -le 0 ]; then
  echo "▶ Aviso: timeout aguardando API. Portal vai subir mesmo assim (pode dar Connection refused até a API levantar)."
fi

echo "▶ Subindo Portal em foreground (Ctrl+C encerra API e Portal)..."
"$SCRIPT_DIR/dev-portal.sh"
