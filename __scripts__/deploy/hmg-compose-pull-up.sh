#!/usr/bin/env bash
# Executar NO SERVIDOR HMG após login GHCR (docker compose pull / up).
# Variáveis obrigatórias: HMG_REGISTRY_PREFIX, HMG_IMAGE_TAG
# Opcional: GHCR_PULL_USER + GHCR_PULL_TOKEN (se ainda não fizeste docker login nesta sessão)
set -euo pipefail

: "${HMG_REGISTRY_PREFIX:?defina HMG_REGISTRY_PREFIX (ex.: ghcr.io/org/repo)}"
: "${HMG_IMAGE_TAG:?defina HMG_IMAGE_TAG (SHA do commit)}"

COMPOSE_DIR="${COMPOSE_DIR:-$HOME/rhportal-hmg}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.hmg.yml}"
export HMG_ENV_FILE="${HMG_ENV_FILE:-$HOME/.env.hmg}"

cd "$COMPOSE_DIR"

if [[ -n "${GHCR_PULL_TOKEN:-}" && -n "${GHCR_PULL_USER:-}" ]]; then
  echo "$GHCR_PULL_TOKEN" | docker login ghcr.io -u "$GHCR_PULL_USER" --password-stdin
fi

if [[ ! -f "$HMG_ENV_FILE" ]]; then
  echo "AVISO: $HMG_ENV_FILE não existe — cria a partir de docs/env.hmg.example (repo)."
fi

docker network inspect rhportal-net >/dev/null 2>&1 || docker network create rhportal-net

docker compose -f "$COMPOSE_FILE" pull

# Parar stack antiga e libertar nomes fixos (container_name). Sem isto, "up" pode falhar com
# Conflict: container name "/rhportal-api" is already in use — ex. stack criada noutro path/projeto.
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
for cname in rhportal-api rhportal-web-next rhportal-portal-vagas rhportal-ai; do
  docker rm -f "$cname" >/dev/null 2>&1 || true
done

docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
docker compose -f "$COMPOSE_FILE" ps

sleep 8
curl -fsS "http://127.0.0.1:5000/health" | head -c 400 || echo "(verifica logs da API se health falhar)"
