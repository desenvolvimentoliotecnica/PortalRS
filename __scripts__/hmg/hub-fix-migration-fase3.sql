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
