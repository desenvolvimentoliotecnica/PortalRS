using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPayRangeValidation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                    ADD COLUMN IF NOT EXISTS "BloqueiaSalarioForaFaixa" boolean NOT NULL DEFAULT false;

                ALTER TABLE "SolicitacoesPromocao"
                    ADD COLUMN IF NOT EXISTS "ForaFaixaSalarial" boolean NOT NULL DEFAULT false;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BloqueiaSalarioForaFaixa",
                table: "TenantConfiguracoes");

            migrationBuilder.DropColumn(
                name: "ForaFaixaSalarial",
                table: "SolicitacoesPromocao");
        }
    }
}
