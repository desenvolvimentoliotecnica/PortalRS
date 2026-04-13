#!/usr/bin/env bash
# RH Portal API — sobe a API com hot reload (dotnet watch).
# Hot reload: altere arquivos .cs e salve; use Ctrl+R no terminal para reiniciar se precisar.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/ports.sh"

# Derruba as portas antes de subir (5056 = API, 5051 = Portal)
free_port 5056
free_port 5051

cd "$ROOT/RHPortal.Api/RHPortal.Api"
echo "▶ API: $ROOT/RHPortal.Api/RHPortal.Api"
exec env InboxFolder__RootPath=/tmp/renderrh-inbox dotnet run
