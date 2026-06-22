#!/usr/bin/env python3
"""Hotfix HMG: rebuild portal-vagas with nginx /api proxy and same-origin API calls."""
from __future__ import annotations

import sys
from pathlib import Path

import paramiko

HOST = "10.0.0.80"
USER = "administrator"
PASSWORD = "Liotec@2026"
REPO_ROOT = Path(__file__).resolve().parents[2]
REMOTE_SRC = "/home/administrator/rh-deploys/current-src"

FILES = [
    (
        REPO_ROOT / "LioTecnica.PortalVagas.React/nginx.conf",
        f"{REMOTE_SRC}/LioTecnica.PortalVagas.React/nginx.conf",
    ),
    (
        REPO_ROOT / "LioTecnica.PortalVagas.React/src/App.tsx",
        f"{REMOTE_SRC}/LioTecnica.PortalVagas.React/src/App.tsx",
    ),
]

BUILD_CMD = """
set -euo pipefail
cd /home/administrator/rh-deploys/current-src
TAG=hotfix-portal-vagas-cors
echo "Building portal-vagas tag=$TAG"
docker build -f LioTecnica.PortalVagas.React/Dockerfile \
  --build-arg VITE_API_BASE_URL= \
  --build-arg VITE_DEFAULT_TENANT=liotecnica \
  -t rhportal-portal-vagas:$TAG LioTecnica.PortalVagas.React
docker stop rhportal-portal-vagas 2>/dev/null || true
docker rm rhportal-portal-vagas 2>/dev/null || true
docker run -d --name rhportal-portal-vagas \
  --network rhportal-net \
  --restart unless-stopped \
  -p 3050:8080 \
  rhportal-portal-vagas:$TAG
sleep 4
curl -fsS http://127.0.0.1:3050/ >/dev/null && echo 'portal html OK'
curl -fsS 'http://127.0.0.1:3050/api/public/vagas?tenantId=liotecnica&page=1&pageSize=2'
echo
docker exec rhportal-portal-vagas sh -c 'grep -hoE "https?://10\\.0\\.0\\.80:5000" /usr/share/nginx/html/assets/*.js 2>/dev/null | sort -u | head -3 || echo NO_DIRECT_API_URL'
"""


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    sftp = client.open_sftp()
    for local, remote in FILES:
        if not local.is_file():
            print(f"Missing local file: {local}", file=sys.stderr)
            return 1
        sftp.put(str(local), remote)
        print(f"uploaded {remote}")
    sftp.close()

    print("Running remote build...")
    _, stdout, stderr = client.exec_command(BUILD_CMD, timeout=900)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    print(out)
    if err.strip():
        print("STDERR:", err[-8000:])
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
