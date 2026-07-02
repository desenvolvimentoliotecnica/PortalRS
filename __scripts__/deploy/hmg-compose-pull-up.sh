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
DOCKER_NETWORK_NAME="${DOCKER_NETWORK_NAME:-rhportal-net}"
DOCKER_NETWORK_SUBNET="${DOCKER_NETWORK_SUBNET:-192.168.241.0/24}"

cd "$COMPOSE_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PURGE_SCRIPT="${PURGE_SCRIPT:-$SCRIPT_DIR/docker-deploy-purge.sh}"

if [[ -n "${GHCR_PULL_TOKEN:-}" && -n "${GHCR_PULL_USER:-}" ]]; then
  echo "$GHCR_PULL_TOKEN" | docker login ghcr.io -u "$GHCR_PULL_USER" --password-stdin
fi

if [[ ! -f "$HMG_ENV_FILE" ]]; then
  echo "ERRO: $HMG_ENV_FILE não existe. Crie o arquivo de ambiente antes do deploy."
  exit 1
fi

if [[ -x "$PURGE_SCRIPT" ]]; then
  DEPLOY_PURGE_REGISTRY_PREFIX="$HMG_REGISTRY_PREFIX" \
  DEPLOY_PURGE_KEEP_TAG="$HMG_IMAGE_TAG" \
  DEPLOY_PURGE_PHASE=pre-pull \
  bash "$PURGE_SCRIPT"
else
  echo "WARN: $PURGE_SCRIPT não encontrado; deploy continua sem purge pré-pull."
fi

docker compose -f "$COMPOSE_FILE" pull

# Parar stack antiga e libertar nomes fixos (container_name). Sem isto, "up" pode falhar com
# Conflict: container name "/rhportal-api" is already in use — ex. stack criada noutro path/projeto.
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
for cname in rhportal-api rhportal-web-next rhportal-portal-vagas rhportal-ai; do
  docker rm -f "$cname" >/dev/null 2>&1 || true
done

current_subnet="$(docker network inspect "$DOCKER_NETWORK_NAME" --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null || true)"
if [[ -n "$current_subnet" && "$current_subnet" != "$DOCKER_NETWORK_SUBNET" ]]; then
  echo "Recriando rede $DOCKER_NETWORK_NAME: subnet atual $current_subnet, desejada $DOCKER_NETWORK_SUBNET"
  docker network rm "$DOCKER_NETWORK_NAME"
  current_subnet=""
fi

if [[ -z "$current_subnet" ]]; then
  docker network create --subnet "$DOCKER_NETWORK_SUBNET" "$DOCKER_NETWORK_NAME"
fi

docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
docker compose -f "$COMPOSE_FILE" ps

if [[ -x "$PURGE_SCRIPT" ]]; then
  DEPLOY_PURGE_REGISTRY_PREFIX="$HMG_REGISTRY_PREFIX" \
  DEPLOY_PURGE_KEEP_TAG="$HMG_IMAGE_TAG" \
  DEPLOY_PURGE_PHASE=post-up \
  bash "$PURGE_SCRIPT"
fi

sleep 8
curl -fsS "http://127.0.0.1:5001/health" | head -c 400 \
  || curl -kfsS "https://127.0.0.1:5000/health" | head -c 400 \
  || echo "(verifica logs da API / Nginx TLS — docs/HMG-ENTRA-TLS.md)"

VERIFY_SCRIPT="${VERIFY_SCRIPT:-$SCRIPT_DIR/verify-web-next-health.sh}"
if [[ -x "$VERIFY_SCRIPT" ]]; then
  WEB_NEXT_CONTAINER=rhportal-web-next bash "$VERIFY_SCRIPT"
else
  echo "WARN: $VERIFY_SCRIPT não encontrado; deploy continua sem validar :3000."
fi
