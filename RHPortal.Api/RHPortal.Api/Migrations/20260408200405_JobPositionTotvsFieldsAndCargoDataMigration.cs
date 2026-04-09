using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class JobPositionTotvsFieldsAndCargoDataMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FullDescription",
                table: "JobPositions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SimilarityIndicator",
                table: "JobPositions",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            // Migra Cargos (TOTVS) → JobPositions quando ainda não existir o mesmo código no tenant.
            // AreaId: primeira área do tenant; Seniority: Pleno (2).
            migrationBuilder.Sql(
                """
                INSERT INTO "JobPositions" (
                    "Id", "TenantId", "Code", "Name", "Status", "AreaId", "Seniority",
                    "Type", "OccupationalClassification", "Description", "DescricaoPublicacao", "NivelHierarquicoId",
                    "SimilarityIndicator", "FullDescription", "CreatedAtUtc", "UpdatedAtUtc"
                )
                SELECT
                    gen_random_uuid(),
                    c."TenantId",
                    (CASE WHEN UPPER(TRIM(c."Code")) LIKE 'CAR-%' THEN UPPER(TRIM(c."Code")) ELSE 'CAR-' || UPPER(TRIM(c."Code")) END),
                    LEFT(TRIM(c."Description"), 160),
                    CASE WHEN c."IsActive" THEN 1 ELSE 2 END,
                    (SELECT a."Id" FROM "Areas" a WHERE a."TenantId" = c."TenantId" ORDER BY a."Code" LIMIT 1),
                    2,
                    NULLIF(LEFT(TRIM(COALESCE(c."CargoType", '')), 180), ''),
                    NULLIF(LEFT(TRIM(COALESCE(c."OccupationalClassification", '')), 30), ''),
                    NULLIF(LEFT(TRIM(c."Description"), 1000), ''),
                    NULL,
                    NULL,
                    CASE WHEN LENGTH(TRIM(COALESCE(c."SimilarityIndicator", ''))) > 0 THEN LEFT(TRIM(c."SimilarityIndicator"), 1) ELSE NULL END,
                    NULLIF(LEFT(TRIM(COALESCE(c."FullDescription", '')), 500), ''),
                    c."CreatedAtUtc",
                    c."UpdatedAtUtc"
                FROM "Cargos" c
                WHERE EXISTS (SELECT 1 FROM "Areas" a WHERE a."TenantId" = c."TenantId")
                  AND NOT EXISTS (
                      SELECT 1 FROM "JobPositions" jp
                      WHERE jp."TenantId" = c."TenantId"
                        AND jp."Code" = (CASE WHEN UPPER(TRIM(c."Code")) LIKE 'CAR-%' THEN UPPER(TRIM(c."Code")) ELSE 'CAR-' || UPPER(TRIM(c."Code")) END)
                  );

                UPDATE "Vagas" v
                SET "JobPositionId" = jp."Id"
                FROM "Cargos" c
                INNER JOIN "JobPositions" jp ON jp."TenantId" = c."TenantId"
                    AND jp."Code" = (CASE WHEN UPPER(TRIM(c."Code")) LIKE 'CAR-%' THEN UPPER(TRIM(c."Code")) ELSE 'CAR-' || UPPER(TRIM(c."Code")) END)
                WHERE v."JobPositionId" = c."Id";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FullDescription",
                table: "JobPositions");

            migrationBuilder.DropColumn(
                name: "SimilarityIndicator",
                table: "JobPositions");
        }
    }
}
