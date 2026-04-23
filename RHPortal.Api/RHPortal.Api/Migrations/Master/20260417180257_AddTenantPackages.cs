using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations.Master
{
    /// <inheritdoc />
    public partial class AddTenantPackages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TenantPackages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PackageKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedByOwnerId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantPackages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantPackages_Owners_UpdatedByOwnerId",
                        column: x => x.UpdatedByOwnerId,
                        principalTable: "Owners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_TenantPackages_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "TenantId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TenantPackages_TenantId_PackageKey",
                table: "TenantPackages",
                columns: new[] { "TenantId", "PackageKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TenantPackages_UpdatedByOwnerId",
                table: "TenantPackages",
                column: "UpdatedByOwnerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TenantPackages");
        }
    }
}
