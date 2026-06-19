-- Repara coluna PasswordHash ausente após deploy do login com senha.
-- Causa: migration 20260619120000_AddHubUserPasswordHash não estava registrada no EF (sem Designer.cs).
--
-- Uso:
--   docker exec -i liotecnica-hub-db psql -U postgres -d liotecnica_hub -v ON_ERROR_STOP=1 < hub-fix-migration-password.sql

ALTER TABLE "HubUsers" ADD COLUMN IF NOT EXISTS "PasswordHash" character varying(500) NULL;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260619120000_AddHubUserPasswordHash', '8.0.11')
ON CONFLICT DO NOTHING;
