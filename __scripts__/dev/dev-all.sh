#!/usr/bin/env bash
# RH Portal — para rodar cada projeto em um terminal da IDE:
#   Cursor/VS Code: Terminal > Run Task... > "Dev: All (4 terminais)"
#   Isso abre 4 terminais na IDE (API, Portal, RHPortal.Ai, Integração RM).
# Este script continua disponível para rodar tudo em um único terminal (background + foreground).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck disable=SC1091
. "$SCRIPT_DIR/ports.sh"

# Derruba as portas antes de subir (5056 = API, 5051 = Portal, 8000 = RHPortal.Ai, 3000/3001 = Next)
for port in 5056 5051 8000 3000 3001; do
  free_port "$port"
done

cleanup() {
  echo ""
  echo "▶ Encerrando API, Portal, AI, Integração e Next..."
  kill "$API_PID" 2>/dev/null || true
  [ -n "$AI_PID" ] && kill "$AI_PID" 2>/dev/null || true
  [ -n "$INTEGRATION_PID" ] && kill "$INTEGRATION_PID" 2>/dev/null || true
  [ -n "${NEXT_PID:-}" ] && kill "$NEXT_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# --- RHPortal.Ai: configurar se não estiver (venv + deps + .env)
AI_DIR="$ROOT/RHPortal.Ai"
if [ -d "$AI_DIR" ]; then
  echo "▶ Configurando RHPortal.Ai (se necessário)..."
  cd "$AI_DIR"
  if [ ! -d ".venv" ]; then
    echo "  Criando .venv..."
    python -m venv .venv
  fi
  if [ -f ".venv/Scripts/activate" ]; then
    # Windows (Git Bash / PowerShell)
    . .venv/Scripts/activate
  else
    . .venv/bin/activate
  fi
  pip install -r requirements.txt
  if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "  Copiando .env.example → .env (edite .env com DATABASE_URL e OPENAI_API_KEY)"
    cp .env.example .env
  fi
  cd "$ROOT"
fi

# --- Integração RM: restore de pacotes (rápido se já estiver atualizado)
INTEGRATION_DIR="$ROOT/Liotecnica.Integration.RM"
if [ -d "$INTEGRATION_DIR" ]; then
  echo "▶ Restaurando dependências da Integração RM..."
  (cd "$INTEGRATION_DIR" && dotnet restore -nologo -v q)
fi

echo "▶ Subindo API em background..."
"$SCRIPT_DIR/dev-api.sh" &
API_PID=$!

AI_PID=""
if [ -d "$AI_DIR" ]; then
  echo "▶ Subindo RHPortal.Ai em background..."
  (
    cd "$AI_DIR"
    if [ -f ".venv/Scripts/activate" ]; then . .venv/Scripts/activate; else . .venv/bin/activate; fi
    exec python -m app.main
  ) &
  AI_PID=$!
fi

INTEGRATION_PID=""
if [ -d "$INTEGRATION_DIR" ]; then
  echo "▶ Subindo Integração RM em background..."
  (cd "$INTEGRATION_DIR" && dotnet run -nologo) &
  INTEGRATION_PID=$!
fi

# --- Next.js: sobe o frontend novo em background (porta 3000)
NEXT_DIR="$ROOT/LioTecnica.Web.Next"
NEXT_PID=""
if [ -d "$NEXT_DIR" ]; then
  echo "▶ Subindo Next.js em background (http://localhost:3000/app)..."
  (
    cd "$NEXT_DIR"
    rm -f .next/dev/lock 2>/dev/null || true
    if [ ! -d "node_modules" ]; then
      pnpm install --silent
    fi
    WATCHPACK_POLLING=true LEGACY_ORIGIN=http://localhost:5051 DEV_API_ORIGIN=http://localhost:5056 PORT=3000 exec pnpm dev
  ) &
  NEXT_PID=$!
fi

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
  echo "▶ Aviso: timeout aguardando API. Portal vai subir mesmo assim."
fi

echo "▶ Subindo Portal em foreground (Ctrl+C encerra todos)..."
"$SCRIPT_DIR/dev-portal.sh"
