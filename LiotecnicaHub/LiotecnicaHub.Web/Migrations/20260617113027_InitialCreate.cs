using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LiotecnicaHub.Web.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "HubAdmins",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubAdmins", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HubApplications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IconUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    LaunchUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Environment = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubApplications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HubEntraConfigs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    EntraTenantId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ClientId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ClientSecretProtected = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    CallbackPath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    HubBaseUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubEntraConfigs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HubApplicationAccessRules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HubApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    RuleType = table.Column<int>(type: "integer", nullable: false),
                    Value = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubApplicationAccessRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HubApplicationAccessRules_HubApplications_HubApplicationId",
                        column: x => x.HubApplicationId,
                        principalTable: "HubApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_HubAdmins_Email",
                table: "HubAdmins",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HubApplicationAccessRules_HubApplicationId",
                table: "HubApplicationAccessRules",
                column: "HubApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_HubApplications_SortOrder",
                table: "HubApplications",
                column: "SortOrder");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HubAdmins");

            migrationBuilder.DropTable(
                name: "HubApplicationAccessRules");

            migrationBuilder.DropTable(
                name: "HubEntraConfigs");

            migrationBuilder.DropTable(
                name: "HubApplications");
        }
    }
}
