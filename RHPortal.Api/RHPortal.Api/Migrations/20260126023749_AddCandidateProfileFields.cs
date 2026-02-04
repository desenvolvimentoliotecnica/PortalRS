using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AvatarContentType",
                table: "Candidatos",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AvatarFileName",
                table: "Candidatos",
                type: "character varying(260)",
                maxLength: 260,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LinkedinUrl",
                table: "Candidatos",
                type: "character varying(260)",
                maxLength: 260,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResumoProfissional",
                table: "Candidatos",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AvatarContentType",
                table: "Candidatos");

            migrationBuilder.DropColumn(
                name: "AvatarFileName",
                table: "Candidatos");

            migrationBuilder.DropColumn(
                name: "LinkedinUrl",
                table: "Candidatos");

            migrationBuilder.DropColumn(
                name: "ResumoProfissional",
                table: "Candidatos");
        }
    }
}
