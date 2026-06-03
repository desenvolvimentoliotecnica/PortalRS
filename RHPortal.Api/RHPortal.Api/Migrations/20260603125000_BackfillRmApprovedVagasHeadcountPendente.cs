using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    [Migration("20260603125000_BackfillRmApprovedVagasHeadcountPendente")]
    public partial class BackfillRmApprovedVagasHeadcountPendente : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "Vagas" AS v
                SET "HeadcountPendente" = 0,
                    "UpdatedAtUtc" = NOW()
                WHERE v."HeadcountPendente" <> 0
                  AND EXISTS (
                      SELECT 1
                      FROM "SolicitacoesVaga" AS s
                      WHERE s."VagaId" = v."Id"
                        AND s."RmIdReq" IS NOT NULL
                        AND s."Status" IN (2, 8)
                  );
                """);

            migrationBuilder.Sql("""
                UPDATE "Vagas" AS v
                SET "IdReqRmOrigem" = s."RmIdReq"::text,
                    "UpdatedAtUtc" = NOW()
                FROM "SolicitacoesVaga" AS s
                WHERE s."VagaId" = v."Id"
                  AND s."RmIdReq" IS NOT NULL
                  AND (v."IdReqRmOrigem" IS NULL OR v."IdReqRmOrigem" = '');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data backfill only. Intentionally not reversible.
        }
    }
}
