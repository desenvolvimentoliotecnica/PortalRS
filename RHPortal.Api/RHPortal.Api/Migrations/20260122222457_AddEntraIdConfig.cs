using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEntraIdConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EntraIdConfigs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    EntraTenantId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ClientId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ClientSecretEncrypted = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    CallbackPath = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EntraIdConfigs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EntraIdConfigs_TenantId",
                table: "EntraIdConfigs",
                column: "TenantId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EntraIdConfigs");
        }
    }
}
