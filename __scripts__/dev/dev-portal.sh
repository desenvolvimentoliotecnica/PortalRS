#!/usr/bin/env bash
# RH Portal Front — sobe o portal (LioTecnica.Web) com hot reload (dotnet watch).
# Hot reload: altere arquivos .cs/.cshtml e salve; use Ctrl+R no terminal para reiniciar se precisar.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/ports.sh"

# Libera só a porta do Portal (5051). Não tocar em 5056 = API (evita matar a API quando chamado por dev-all.sh).
free_port 5051
# Espera a porta 5051 ficar livre (até 15 s)
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  p="$(port_pids 5051 || true)"
  if [ -z "$p" ]; then
    break
  fi
  echo "▶ Aguardando porta 5051 liberar... ($i/15)"
  sleep 1
done
p="$(port_pids 5051 || true)"
if [ -n "$p" ]; then
  echo "▶ Aviso: porta 5051 ainda em uso (PID $p). Encerre o processo manualmente ou rode: kill -9 $p"
  sleep 2
fi
cd "$ROOT/LioTecnica.Web"
echo "▶ Portal (hot reload): $ROOT/LioTecnica.Web"
exec dotnet watch run
