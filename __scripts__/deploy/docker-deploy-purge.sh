#!/usr/bin/env bash
# Libera disco no servidor antes/depois de deploy Docker (GHCR pull).
# Remove cache de build, imagens dangling e tags SHA antigas das imagens rhportal-*.
#
# Variáveis (opcionais):
#   DEPLOY_PURGE_REGISTRY_PREFIX  — ex.: ghcr.io/org/repo (ou DEV_/HMG_/PRD_REGISTRY_PREFIX)
#   DEPLOY_PURGE_KEEP_TAG         — SHA do deploy actual (ou DEV_/HMG_/PRD_IMAGE_TAG)
#   DEPLOY_PURGE_KEEP_SHA_TAGS    — quantas tags SHA recentes manter por serviço (default: 2)
#   DEPLOY_PURGE_BUILDER          — 1 para docker builder prune (default: 1)
#   DEPLOY_PURGE_PHASE            — rótulo no log: pre-pull | post-up (default: pre-pull)
set -euo pipefail

REGISTRY_PREFIX="${DEPLOY_PURGE_REGISTRY_PREFIX:-${DEV_REGISTRY_PREFIX:-${HMG_REGISTRY_PREFIX:-${PRD_REGISTRY_PREFIX:-}}}}"
CURRENT_TAG="${DEPLOY_PURGE_KEEP_TAG:-${DEV_IMAGE_TAG:-${HMG_IMAGE_TAG:-${PRD_IMAGE_TAG:-}}}}"
KEEP_SHA_TAGS="${DEPLOY_PURGE_KEEP_SHA_TAGS:-2}"
PURGE_BUILDER="${DEPLOY_PURGE_BUILDER:-1}"
PHASE="${DEPLOY_PURGE_PHASE:-pre-pull}"

REPOS=(rhportal-api rhportal-web-next rhportal-portal-vagas rhportal-ai)

avail_bytes() {
  local v
  v="$(df -B1 / 2>/dev/null | awk 'NR==2 {print $4}' || true)"
  if [[ -n "$v" && "$v" =~ ^[0-9]+$ ]]; then
    echo "$v"
    return 0
  fi
  df -Pk / 2>/dev/null | awk 'NR==2 {print $4 * 1024}'
}

log_disk() {
  echo "=== Disco (/) — fase ${PHASE} ==="
  df -h / || true
  if command -v docker >/dev/null 2>&1; then
    echo "=== Docker system df ==="
    docker system df 2>/dev/null || true
  fi
}

purge_old_sha_tags_for_repo() {
  local img_prefix="$1"
  local keep_tag="$2"
  local keep_n="$3"

  mapfile -t sha_lines < <(
    docker images "$img_prefix" --format '{{.Tag}}\t{{.ID}}' 2>/dev/null \
      | awk -F'\t' -v keep="$keep_tag" '$1 ~ /^[0-9a-f]{40}$/ && $1 != keep {print}'
  )

  local count="${#sha_lines[@]}"
  if (( count <= keep_n )); then
    echo "  ${img_prefix}: ${count} tag(s) SHA (mantendo até ${keep_n})"
    return 0
  fi

  local i=0
  for line in "${sha_lines[@]}"; do
    if (( i >= keep_n )); then
      local tag="${line%%$'\t'*}"
      local id="${line#*$'\t'}"
      echo "  rmi ${img_prefix}:${tag}"
      docker rmi "${img_prefix}:${tag}" 2>/dev/null || docker rmi -f "$id" 2>/dev/null || echo "  WARN: não removeu ${img_prefix}:${tag} (pode estar em uso)"
    fi
    i=$((i + 1))
  done
}

echo ">>> docker-deploy-purge.sh (${PHASE})"
BEFORE="$(avail_bytes || echo "0")"
echo "__RH_DEPLOY_DISK_BEFORE__=${BEFORE}__"
log_disk

if ! command -v docker >/dev/null 2>&1; then
  echo "WARN: docker não encontrado; purge ignorado."
  echo "__RH_DEPLOY_DISK_AFTER__=${BEFORE}__"
  exit 0
fi

echo ">>> docker image prune -f (dangling)"
docker image prune -f || true

if [[ "$PURGE_BUILDER" == "1" ]]; then
  echo ">>> docker builder prune -af"
  docker builder prune -af || echo "WARN: docker builder prune falhou (continuando)"
fi

if [[ -n "$REGISTRY_PREFIX" ]]; then
  echo ">>> Removendo tags SHA antigas em ${REGISTRY_PREFIX}/rhportal-* (mantém tag actual + ${KEEP_SHA_TAGS} recentes)"
  for repo in "${REPOS[@]}"; do
    purge_old_sha_tags_for_repo "${REGISTRY_PREFIX}/${repo}" "$CURRENT_TAG" "$KEEP_SHA_TAGS"
  done
else
  echo "WARN: REGISTRY_PREFIX não definido; pulando purge de tags SHA."
fi

# Imagens órfãs não referenciadas por nenhum container (não remove as em execução).
echo ">>> docker image prune -af (imagens sem container)"
docker image prune -af || echo "WARN: docker image prune -af falhou (continuando)"

AFTER="$(avail_bytes || echo "0")"
echo "__RH_DEPLOY_DISK_AFTER__=${AFTER}__"
log_disk

if [[ "$BEFORE" =~ ^[0-9]+$ && "$AFTER" =~ ^[0-9]+$ && "$AFTER" -ge "$BEFORE" ]]; then
  gained=$((AFTER - BEFORE))
  echo ">>> Espaço livre ganho: ~$(( gained / 1024 / 1024 )) MiB"
fi
