using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFluxoAprovacaoConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FluxosAprovacaoConfig",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TipoFluxo = table.Column<short>(type: "smallint", nullable: false),
                    ReferenciaUnidade = table.Column<short>(type: "smallint", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FluxosAprovacaoConfig", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FluxosAprovacaoConfig_TenantId_TipoFluxo",
                table: "FluxosAprovacaoConfig",
                columns: new[] { "TenantId", "TipoFluxo" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FluxosAprovacaoConfig");
        }
    }
}
