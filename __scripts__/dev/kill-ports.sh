#!/usr/bin/env bash
# Libera as portas do RH Portal (5051 = Portal, 5056 = API).
# Mata também o processo pai (ex.: dotnet watch) para não ressuscitar e ocupar a porta.
set -e
PORTS="${1:-5051 5056}"
for port in $PORTS; do
  pids=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "▶ Encerrando processo(s) na porta $port (PID $pids) e pais (dotnet watch)..."
    for pid in $pids; do
      ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
      [ -n "$ppid" ] && [ "$ppid" -gt 1 ] && kill -9 "$ppid" 2>/dev/null || true
    done
    echo "$pids" | xargs kill -9 2>/dev/null || true
  else
    echo "▶ Porta $port já está livre"
  fi
done
sleep 2
echo "▶ Pronto. Pode rodar ./dev-portal.sh ou ./dev-api.sh"
