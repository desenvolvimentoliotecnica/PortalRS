#!/usr/bin/env bash
# Executar NO SERVIDOR após copiar o .tar para $HOME (usa inspect atual antes de recriar).
set -euo pipefail
TAR="${1:-$HOME/rhportal-hmg-devops-lucas-images.tar}"
if [[ ! -f "$TAR" ]]; then
  echo "Ficheiro não encontrado: $TAR"
  exit 1
fi

echo "==> Guardando config atual dos contentores..."
docker inspect rhportal-api > /tmp/api.before.json
docker inspect rhportal-portal-vagas > /tmp/portal.before.json

echo "==> docker load..."
docker load -i "$TAR"

echo "==> Parando e removendo contentores antigos..."
docker stop rhportal-api rhportal-portal-vagas
docker rm rhportal-api rhportal-portal-vagas

echo "==> Subindo API com as mesmas variáveis..."
mapfile -t ENV_LINES < <(jq -r '.[0].Config.Env[]' /tmp/api.before.json | grep -v '^HOSTNAME=' || true)
ENV_ARGS=()
for line in "${ENV_LINES[@]}"; do ENV_ARGS+=(-e "$line"); done

docker run -d \
  --name rhportal-api \
  --network rhportal-net \
  -p 5000:80 \
  --restart unless-stopped \
  --add-host host.docker.internal:host-gateway \
  "${ENV_ARGS[@]}" \
  rhportal-api-devops-lucas:local

echo "==> Subindo Portal Vagas..."
docker run -d \
  --name rhportal-portal-vagas \
  --network rhportal-net \
  -p 3050:8080 \
  --restart unless-stopped \
  rhportal-portal-vagas-devops-lucas:local

echo "==> Estado:"
docker ps --filter name=rhportal-api --filter name=rhportal-portal-vagas --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo "==> Health API (aguardar Kestrel + curl host):"
sleep 8
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5000/health || docker exec rhportal-api wget -qO- http://127.0.0.1/health | head -c 200
