#!/usr/bin/env bash
# RH Portal — para rodar cada projeto em um terminal da IDE:
#   Cursor/VS Code: Terminal > Run Task... > "Dev: All (4 terminais)"
#   Isso abre 4 terminais na IDE (API, Portal, RHPortal.Ai, Integração RM).
# Este script continua disponível para rodar tudo em um único terminal (background + foreground).
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Derruba as portas antes de subir (5056 = API, 5051 = Portal, 8000 = RHPortal.Ai)
for port in 5056 5051 8000; do
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
sleep 2

cleanup() {
  echo ""
  echo "▶ Encerrando API, Portal, AI e Integração..."
  kill "$API_PID" 2>/dev/null || true
  [ -n "$AI_PID" ] && kill "$AI_PID" 2>/dev/null || true
  [ -n "$INTEGRATION_PID" ] && kill "$INTEGRATION_PID" 2>/dev/null || true
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
