using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260411210000_AddFuncionarioHasIncompleteData")]
    public partial class AddFuncionarioHasIncompleteData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN

-- Adiciona coluna HasIncompleteData na tabela Funcionarios
ALTER TABLE ""Funcionarios""
    ADD COLUMN IF NOT EXISTS ""HasIncompleteData"" boolean NOT NULL DEFAULT false;

-- Popula o valor inicial para todos os registros existentes
UPDATE ""Funcionarios""
SET ""HasIncompleteData"" = (
    ""Name"" IS NULL OR ""Name"" = '' OR
    ""PessoaId"" IS NULL OR
    ""JobPositionId"" IS NULL OR
    ""UnidadeLotacaoId"" IS NULL OR
    ""NivelHierarquicoId"" IS NULL OR
    ""CentroCustoId"" IS NULL
);

END $$;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
ALTER TABLE ""Funcionarios"" DROP COLUMN IF EXISTS ""HasIncompleteData"";
");
        }
    }
}
