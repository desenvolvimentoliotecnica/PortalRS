using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <summary>
    /// Adiciona <c>NomeEngessado</c> à tabela <c>Vagas</c>.
    /// Campo interno/fixo da vaga, separado do título público. Não editável após publicação.
    /// </summary>
    public partial class AddVagaNomeEngessado : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NomeEngessado",
                table: "Vagas",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NomeEngessado",
                table: "Vagas");
        }
    }
}
