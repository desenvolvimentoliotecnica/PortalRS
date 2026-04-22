using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AlterVagaIdNullableOcupacaoHistorico : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "OcupacoesHistorico" ALTER COLUMN "VagaId" DROP NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "OcupacoesHistorico" SET "VagaId" = '00000000-0000-0000-0000-000000000000' WHERE "VagaId" IS NULL;
                ALTER TABLE "OcupacoesHistorico" ALTER COLUMN "VagaId" SET NOT NULL;
                """);
        }
    }
}
