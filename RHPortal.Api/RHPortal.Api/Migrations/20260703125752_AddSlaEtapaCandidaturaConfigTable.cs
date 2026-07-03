using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSlaEtapaCandidaturaConfigTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "SlaEtapaCandidaturaConfigs" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "Etapa" smallint NOT NULL,
                    "SlaDias" integer NOT NULL,
                    "Ativo" boolean NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_SlaEtapaCandidaturaConfigs" PRIMARY KEY ("Id")
                );
                """);

            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_SlaEtapaCandidaturaConfigs_TenantId_Etapa"
                ON "SlaEtapaCandidaturaConfigs" ("TenantId", "Etapa");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP TABLE IF EXISTS "SlaEtapaCandidaturaConfigs";""");
        }
    }
}
