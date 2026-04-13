using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <summary>
    /// Adiciona <c>NomeEngessado</c> à tabela <c>Vagas</c>.
    /// Campo interno/fixo da vaga, separado do título público. Não editável após publicação.
    /// SQL idempotente; inclui atributos de migration para descoberta pelo EF Core.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20260318000000_AddVagaNomeEngessado")]
    public partial class AddVagaNomeEngessado : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Vagas"
                ADD COLUMN IF NOT EXISTS "NomeEngessado" character varying(200) NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""ALTER TABLE "Vagas" DROP COLUMN IF EXISTS "NomeEngessado";""");
        }
    }
}
