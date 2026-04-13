using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class MakeFuncionarioEmailOptional : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Funcionarios_TenantId_Email",
                table: "Funcionarios");

            migrationBuilder.AddColumn<short>(
                name: "Tipo",
                table: "Roles",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Funcionarios",
                type: "character varying(180)",
                maxLength: 180,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(180)",
                oldMaxLength: 180);

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_TenantId_Email",
                table: "Funcionarios",
                columns: new[] { "TenantId", "Email" },
                filter: "\"Email\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Funcionarios_TenantId_Email",
                table: "Funcionarios");

            migrationBuilder.DropColumn(
                name: "Tipo",
                table: "Roles");

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Funcionarios",
                type: "character varying(180)",
                maxLength: 180,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(180)",
                oldMaxLength: 180,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_TenantId_Email",
                table: "Funcionarios",
                columns: new[] { "TenantId", "Email" },
                unique: true);
        }
    }
}
