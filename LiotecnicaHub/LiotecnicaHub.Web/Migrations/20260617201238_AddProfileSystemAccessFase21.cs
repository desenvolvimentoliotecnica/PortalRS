using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LiotecnicaHub.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileSystemAccessFase21 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "HubProfileSystemAccesses",
                columns: table => new
                {
                    ProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    SystemId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubProfileSystemAccesses", x => new { x.ProfileId, x.SystemId });
                    table.ForeignKey(
                        name: "FK_HubProfileSystemAccesses_HubProfiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "HubProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HubProfileSystemAccesses_HubSystems_SystemId",
                        column: x => x.SystemId,
                        principalTable: "HubSystems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_HubProfileSystemAccesses_SystemId",
                table: "HubProfileSystemAccesses",
                column: "SystemId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HubProfileSystemAccesses");
        }
    }
}
