#!/usr/bin/env bash
# Libera as portas do RH Portal (5051 = Portal, 5056 = API, 3000 = Next).
# Funciona no Windows (Git Bash) e Linux/macOS.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/ports.sh"

PORTS="${1:-5051 5056 3000 3001}"
for port in $PORTS; do
  free_port "$port"
done

echo "▶ Pronto. Pode rodar ./dev-all.sh (ou ./dev-next.sh)."
