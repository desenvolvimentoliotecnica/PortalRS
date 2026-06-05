#!/usr/bin/env bash
# Executar NO SERVIDOR PRD após login GHCR (docker compose pull / up).
# Variáveis obrigatórias: PRD_REGISTRY_PREFIX, PRD_IMAGE_TAG
# Opcional: GHCR_PULL_USER + GHCR_PULL_TOKEN (se ainda não fez docker login nesta sessão)
set -euo pipefail

: "${PRD_REGISTRY_PREFIX:?defina PRD_REGISTRY_PREFIX (ex.: ghcr.io/org/repo)}"
: "${PRD_IMAGE_TAG:?defina PRD_IMAGE_TAG (SHA do commit)}"

COMPOSE_DIR="${COMPOSE_DIR:-$HOME/rhportal-prd}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prd.yml}"
export PRD_ENV_FILE="${PRD_ENV_FILE:-$HOME/.env.prd}"
export PRD_API_APP_DATA_DIR="${PRD_API_APP_DATA_DIR:-/dados/rhportal-prd/api-app-data}"
DOCKER_NETWORK_NAME="${DOCKER_NETWORK_NAME:-rhportal-prd-net}"
DOCKER_NETWORK_SUBNET="${DOCKER_NETWORK_SUBNET:-192.168.242.0/24}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-rhportal-prd-postgres}"

cd "$COMPOSE_DIR"

if [[ -n "${GHCR_PULL_TOKEN:-}" && -n "${GHCR_PULL_USER:-}" ]]; then
  echo "$GHCR_PULL_TOKEN" | docker login ghcr.io -u "$GHCR_PULL_USER" --password-stdin
fi

if [[ ! -f "$PRD_ENV_FILE" ]]; then
  echo "ERRO: $PRD_ENV_FILE não existe. Crie o arquivo de ambiente antes do deploy."
  exit 1
fi

mkdir -p "$PRD_API_APP_DATA_DIR"

current_subnet="$(docker network inspect "$DOCKER_NETWORK_NAME" --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null || true)"
if [[ -n "$current_subnet" && "$current_subnet" != "$DOCKER_NETWORK_SUBNET" ]]; then
  echo "Recriando rede $DOCKER_NETWORK_NAME: subnet atual $current_subnet, desejada $DOCKER_NETWORK_SUBNET"
  docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
  docker network rm "$DOCKER_NETWORK_NAME"
  current_subnet=""
fi

if [[ -z "$current_subnet" ]]; then
  docker network create --subnet "$DOCKER_NETWORK_SUBNET" "$DOCKER_NETWORK_NAME"
fi

if docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1; then
  if ! docker network inspect "$DOCKER_NETWORK_NAME" --format '{{json .Containers}}' | grep -q "\"$POSTGRES_CONTAINER\""; then
    docker network connect "$DOCKER_NETWORK_NAME" "$POSTGRES_CONTAINER" 2>/dev/null || true
  fi
fi

docker compose -f "$COMPOSE_FILE" pull

# Parar apenas a stack PRD e libertar nomes fixos PRD. Não toca em PMO, Portainer, NPM ou HML/DEV.
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
for cname in rhportal-prd-api rhportal-prd-web-next rhportal-prd-portal-vagas rhportal-prd-ai; do
  docker rm -f "$cname" >/dev/null 2>&1 || true
done

docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
docker compose -f "$COMPOSE_FILE" ps

sleep 8
curl -fsS "http://127.0.0.1:5000/health" | head -c 400 || echo "(verifica logs da API se health falhar)"
