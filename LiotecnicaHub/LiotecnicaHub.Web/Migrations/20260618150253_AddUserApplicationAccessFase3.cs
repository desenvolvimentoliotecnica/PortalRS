using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LiotecnicaHub.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddUserApplicationAccessFase3 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ApplicationId",
                table: "HubAccessAudits",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "HubUserApplicationAccesses",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ApplicationId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubUserApplicationAccesses", x => new { x.UserId, x.ApplicationId });
                    table.ForeignKey(
                        name: "FK_HubUserApplicationAccesses_HubApplications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalTable: "HubApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HubUserApplicationAccesses_HubUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "HubUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_HubUserApplicationAccesses_ApplicationId",
                table: "HubUserApplicationAccesses",
                column: "ApplicationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HubUserApplicationAccesses");

            migrationBuilder.DropColumn(
                name: "ApplicationId",
                table: "HubAccessAudits");
        }
    }
}
