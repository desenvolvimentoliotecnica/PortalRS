#!/usr/bin/env bash
# RH Portal Front — sobe o portal (LioTecnica.Web) com hot reload (dotnet watch).
# Hot reload: altere arquivos .cs/.cshtml e salve; use Ctrl+R no terminal para reiniciar se precisar.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# Libera só a porta do Portal (5051). Não tocar em 5056 = API (evita matar a API quando chamado por dev-all.sh).
for port in 5051; do
  p=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  [ -z "$p" ] && p=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -n "$p" ]; then
    echo "▶ Liberando porta $port (PID $p)..."
    for pid in $p; do
      ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
      [ -n "$ppid" ] && [ "$ppid" -gt 1 ] && kill -9 "$ppid" 2>/dev/null || true
    done
    echo "$p" | xargs kill -9 2>/dev/null || true
  fi
done
# Espera a porta 5051 ficar livre (até 15 s)
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  p=$(lsof -ti :5051 2>/dev/null || true)
  if [ -z "$p" ]; then
    break
  fi
  echo "▶ Aguardando porta 5051 liberar... ($i/15)"
  sleep 1
done
p=$(lsof -ti :5051 2>/dev/null || true)
if [ -n "$p" ]; then
  echo "▶ Aviso: porta 5051 ainda em uso (PID $p). Encerre o processo manualmente ou rode: kill -9 $p"
  sleep 2
fi
cd "$ROOT/LioTecnica.Web"
echo "▶ Portal (hot reload): $ROOT/LioTecnica.Web"
exec dotnet watch run
