#!/usr/bin/env bash
# Wrapper para preview_start do Claude Code — limpa lock antes de subir.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

NEXT_DIR="/Users/victoralves/Projects/Voltage.RenderRH/LioTecnica.Web.Next"
rm -f "$NEXT_DIR/.next/dev/lock" 2>/dev/null || true

cd "$NEXT_DIR"

NODE_OPTIONS="--max-old-space-size=2048" \
PORT=3000 \
DEV_API_ORIGIN="http://localhost:5056" \
LEGACY_ORIGIN="http://localhost:5051" \
exec pnpm dev
