#!/usr/bin/env bash
# TLS na porta 5000 para callback Entra ID (HML). Executar no servidor como administrator.
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-$HOME/rhportal-hmg}"
ENV_FILE="${ENV_FILE:-$HOME/.env.hmg}"
SUDO_PASS="${SUDO_PASS:?defina SUDO_PASS}"

sudo_cmd() {
  printf '%s\n' "$SUDO_PASS" | sudo -S "$@"
}

TS=$(date +%Y%m%d-%H%M%S)
cp "$ENV_FILE" "$ENV_FILE.bak-$TS"

if grep -q '^Authentication__ApiBaseUrl=' "$ENV_FILE"; then
  sed -i 's|^Authentication__ApiBaseUrl=.*|Authentication__ApiBaseUrl=https://10.0.0.80:5000|' "$ENV_FILE"
else
  echo 'Authentication__ApiBaseUrl=https://10.0.0.80:5000' >> "$ENV_FILE"
fi

export HMG_ENV_FILE="$ENV_FILE"
cd "$COMPOSE_DIR"
docker compose -f docker-compose.hmg.yml -f docker-compose.override.yml up -d api

sleep 6
curl -fsS http://127.0.0.1:5001/health | head -c 160
echo

sudo_cmd mkdir -p /etc/nginx/ssl
if [[ ! -f /etc/nginx/ssl/rhportal-api.crt ]]; then
  sudo_cmd openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/rhportal-api.key \
    -out /etc/nginx/ssl/rhportal-api.crt \
    -subj "/CN=10.0.0.80" \
    -addext "subjectAltName=IP:10.0.0.80"
fi

sudo_cmd tee /etc/nginx/sites-available/rhportal-api-tls >/dev/null <<'NGINX'
server {
    listen 5000 ssl;
    listen [::]:5000 ssl;
    server_name 10.0.0.80;

    ssl_certificate     /etc/nginx/ssl/rhportal-api.crt;
    ssl_certificate_key /etc/nginx/ssl/rhportal-api.key;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }
}
NGINX

sudo_cmd ln -sf /etc/nginx/sites-available/rhportal-api-tls /etc/nginx/sites-enabled/rhportal-api-tls
sudo_cmd nginx -t
sudo_cmd systemctl enable nginx
sudo_cmd systemctl restart nginx

echo "=== HTTPS health ==="
curl -kfsS https://127.0.0.1:5000/health | head -c 160
echo
echo "=== ports ==="
ss -tlnp | grep -E ':5000|:5001' || true
echo "DONE"
