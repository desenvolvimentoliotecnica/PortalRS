using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFuncionarioRequisitoCategoriaId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "RequisitoCategoriaId",
                table: "Funcionarios",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_RequisitoCategoriaId",
                table: "Funcionarios",
                column: "RequisitoCategoriaId");

            migrationBuilder.AddForeignKey(
                name: "FK_Funcionarios_RequisitoCategorias_RequisitoCategoriaId",
                table: "Funcionarios",
                column: "RequisitoCategoriaId",
                principalTable: "RequisitoCategorias",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Funcionarios_RequisitoCategorias_RequisitoCategoriaId",
                table: "Funcionarios");

            migrationBuilder.DropIndex(
                name: "IX_Funcionarios_RequisitoCategoriaId",
                table: "Funcionarios");

            migrationBuilder.DropColumn(
                name: "RequisitoCategoriaId",
                table: "Funcionarios");
        }
    }
}
