#!/usr/bin/env bash
# Sobe o frontend Next.js integrado ao legado (BFF via cookies).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/ports.sh"

NEXT_DIR="$ROOT/LioTecnica.Web.Next"
if [ ! -d "$NEXT_DIR" ]; then
  echo "✖ Pasta do Next não encontrada em: $NEXT_DIR"
  exit 1
fi

# Libera portas do Next
free_port 3000
free_port 3001

cd "$NEXT_DIR"
rm -f .next/dev/lock 2>/dev/null || true

echo "▶ Instalando deps (se necessário)..."
if [ ! -d "node_modules" ]; then
  pnpm install --silent
fi

echo "▶ Subindo Next em http://localhost:3000/app"
WATCHPACK_POLLING=true LEGACY_ORIGIN="${LEGACY_ORIGIN:-http://localhost:5051}" DEV_API_ORIGIN="${DEV_API_ORIGIN:-http://localhost:5056}" PORT=3000 exec pnpm dev

