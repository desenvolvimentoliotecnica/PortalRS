using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVagaUnifiedMatchingCache : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "VagaUnifiedMatchingCaches",
                columns: table => new
                {
                    VagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CurrentFiltersHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PendingFiltersHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StartedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ComputedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastAccessAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ItemsJson = table.Column<string>(type: "jsonb", nullable: true),
                    LastError = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VagaUnifiedMatchingCaches", x => x.VagaId);
                    table.ForeignKey(
                        name: "FK_VagaUnifiedMatchingCaches_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VagaUnifiedMatchingCaches_TenantId_Status",
                table: "VagaUnifiedMatchingCaches",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_VagaUnifiedMatchingCaches_TenantId_VagaId",
                table: "VagaUnifiedMatchingCaches",
                columns: new[] { "TenantId", "VagaId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VagaUnifiedMatchingCaches");
        }
    }
}
