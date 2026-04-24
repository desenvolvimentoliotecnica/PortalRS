using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBlipApiUrlAndKeyNaTenantConfiguracao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BlipApiKey",
                table: "TenantConfiguracoes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BlipApiUrl",
                table: "TenantConfiguracoes",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BlipApiKey",
                table: "TenantConfiguracoes");

            migrationBuilder.DropColumn(
                name: "BlipApiUrl",
                table: "TenantConfiguracoes");
        }
    }
}
