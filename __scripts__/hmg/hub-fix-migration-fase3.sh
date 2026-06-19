#!/usr/bin/env bash
# Repara migration Fase3 que falhou no Postgres (TEXT vs uuid) e sobe o Hub.
# Uso no HMG (10.0.0.80):
#   bash __scripts__/hmg/hub-fix-migration-fase3.sh

set -euo pipefail

DB_CONTAINER="${HUB_DB_CONTAINER:-liotecnica-hub-db}"
HUB_CONTAINER="${HUB_APP_CONTAINER:-liotecnica-hub}"
DB_NAME="${HUB_POSTGRES_DB:-liotecnica_hub}"
DB_USER="${HUB_POSTGRES_USER:-postgres}"

echo "==> Corrigindo schema parcial da migration AddUserApplicationAccessFase3..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE "HubAccessAudits" DROP COLUMN IF EXISTS "ApplicationId";
ALTER TABLE "HubAccessAudits" ADD COLUMN IF NOT EXISTS "ApplicationId" uuid NULL;

DROP TABLE IF EXISTS "HubUserApplicationAccesses";

CREATE TABLE "HubUserApplicationAccesses" (
    "UserId" uuid NOT NULL,
    "ApplicationId" uuid NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "CreatedByUserId" uuid NULL,
    CONSTRAINT "PK_HubUserApplicationAccesses" PRIMARY KEY ("UserId", "ApplicationId"),
    CONSTRAINT "FK_HubUserApplicationAccesses_HubApplications_ApplicationId" FOREIGN KEY ("ApplicationId") REFERENCES "HubApplications" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_HubUserApplicationAccesses_HubUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "HubUsers" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_HubUserApplicationAccesses_ApplicationId" ON "HubUserApplicationAccesses" ("ApplicationId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260618150253_AddUserApplicationAccessFase3', '8.0.11')
ON CONFLICT DO NOTHING;
SQL

echo "==> Reiniciando container do Hub..."
docker start "$HUB_CONTAINER" >/dev/null 2>&1 || docker restart "$HUB_CONTAINER" >/dev/null

echo "==> Aguardando /health..."
for _ in $(seq 1 25); do
  if docker exec "$HUB_CONTAINER" wget -qO- http://127.0.0.1:3010/health >/dev/null 2>&1; then
    echo "OK: Hub healthy em https://10.0.0.80:3010"
    exit 0
  fi
  sleep 2
done

echo "WARN: Hub ainda não respondeu. Logs:"
docker logs "$HUB_CONTAINER" --tail 40
exit 1
