using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <summary>
    /// Backfill idempotente: alinha o cache <c>Candidato.VagaId</c> com a
    /// <c>VagaId</c> da <see cref="Candidatura"/> ativa mais recente
    /// (ou qualquer mais recente se não houver ativa). Candidatos sem candidatura
    /// preservam o <c>VagaId</c> atual (captação manual pelo admin antes da migração
    /// para a junction).
    /// </summary>
    public partial class SyncCandidatoVagaIdFromCandidaturas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1) Se existir candidatura ATIVA, aponta VagaId p/ a mais recente ativa.
            migrationBuilder.Sql("""
                UPDATE "Candidatos" c
                SET "VagaId" = sub."VagaId",
                    "UpdatedAtUtc" = NOW() AT TIME ZONE 'UTC'
                FROM (
                    SELECT DISTINCT ON (cand."CandidatoId")
                           cand."CandidatoId",
                           cand."VagaId"
                    FROM "Candidaturas" cand
                    WHERE cand."Status" = 0
                    ORDER BY cand."CandidatoId", cand."AplicadaEmUtc" DESC, cand."CreatedAtUtc" DESC
                ) AS sub
                WHERE c."Id" = sub."CandidatoId"
                  AND (c."VagaId" IS DISTINCT FROM sub."VagaId");
                """);

            // 2) Para candidatos sem candidatura ativa mas com qualquer candidatura,
            //    usar a mais recente (qualquer status) como fallback do cache.
            migrationBuilder.Sql("""
                UPDATE "Candidatos" c
                SET "VagaId" = sub."VagaId",
                    "UpdatedAtUtc" = NOW() AT TIME ZONE 'UTC'
                FROM (
                    SELECT DISTINCT ON (cand."CandidatoId")
                           cand."CandidatoId",
                           cand."VagaId"
                    FROM "Candidaturas" cand
                    ORDER BY cand."CandidatoId", cand."AplicadaEmUtc" DESC, cand."CreatedAtUtc" DESC
                ) AS sub
                WHERE c."Id" = sub."CandidatoId"
                  AND NOT EXISTS (
                      SELECT 1 FROM "Candidaturas" ativa
                      WHERE ativa."CandidatoId" = c."Id" AND ativa."Status" = 0
                  )
                  AND (c."VagaId" IS DISTINCT FROM sub."VagaId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Backfill não é reversível sem perder informação. Intencionalmente vazio.
        }
    }
}
