using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations.Master
{
    /// <inheritdoc />
    public partial class AddAiProviderKeyIsDefault : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsDefault",
                table: "AiProviderKeys",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsDefault",
                table: "AiProviderKeys");
        }
    }
}
