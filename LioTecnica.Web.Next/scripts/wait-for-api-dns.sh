#!/bin/sh
# Aguarda o serviço "api" na rede Docker antes de subir o nginx (evita crash loop).
set -e

if [ "${NGINX_WAIT_FOR_API:-1}" = "0" ]; then
  exit 0
fi

max="${NGINX_WAIT_FOR_API_MAX:-90}"
i=0

until ping -c1 -W1 api >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge "$max" ]; then
    echo "ERRO: serviço api inalcançável na rede Docker após ${max}s" >&2
    exit 1
  fi
  echo "Aguardando serviço api na rede Docker (${i}/${max})..."
  sleep 1
done
