using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LiotecnicaHub.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddHubUserPasswordHash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PasswordHash",
                table: "HubUsers",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PasswordHash",
                table: "HubUsers");
        }
    }
}
