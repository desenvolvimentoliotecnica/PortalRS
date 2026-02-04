#!/usr/bin/env bash
# RH Portal API — sobe a API com hot reload (dotnet watch).
# Hot reload: altere arquivos .cs e salve; use Ctrl+R no terminal para reiniciar se precisar.
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Derruba as portas antes de subir (5056 = API, 5051 = Portal)
for port in 5056 5051; do
  p=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  [ -z "$p" ] && p=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -n "$p" ]; then
    echo "▶ Liberando porta $port (PID $p)..."
    echo "$p" | xargs kill -9 2>/dev/null || true
  fi
done
sleep 2
cd "$ROOT/RHPortal.Api/RHPortal.Api"
echo "▶ API (hot reload): $ROOT/RHPortal.Api/RHPortal.Api"
exec dotnet watch run
