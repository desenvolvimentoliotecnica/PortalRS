using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <summary>
    /// Adiciona <c>PretensaoSalarial</c> à tabela <c>Candidatos</c>.
    ///
    /// Nota: o nome da classe menciona "ELinkedin" porque o planejamento
    /// original incluía ambos os campos, mas <c>LinkedinUrl</c> e
    /// <c>TrabalhandoAtualmente</c> já haviam sido adicionados em migrations
    /// anteriores (20260126_AddCandidateProfileFields e
    /// 20260311_Sprint1a6_HierarquiaProjetosFases). Apenas
    /// <c>PretensaoSalarial</c> é de fato acrescentado aqui.
    /// </summary>
    public partial class AddCandidatoPretensaoSalarialELinkedin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'Candidatos' AND column_name = 'PretensaoSalarial'
                    ) THEN
                        ALTER TABLE "Candidatos" ADD "PretensaoSalarial" numeric(18,2);
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PretensaoSalarial",
                table: "Candidatos");
        }
    }
}
