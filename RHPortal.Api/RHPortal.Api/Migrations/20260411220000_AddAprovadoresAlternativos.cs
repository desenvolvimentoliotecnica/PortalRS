using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260411220000_AddAprovadoresAlternativos")]
    public partial class AddAprovadoresAlternativos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN

CREATE TABLE IF NOT EXISTS ""AprovadoresAlternativos"" (
    ""Id"" uuid NOT NULL,
    ""TenantId"" character varying(64) NOT NULL,
    ""GestorId"" uuid NOT NULL,
    ""AprovadorId"" uuid NOT NULL,
    ""DataInicio"" date NOT NULL,
    ""DataFim"" date NULL,
    ""CreatedAtUtc"" timestamptz NOT NULL,
    ""UpdatedAtUtc"" timestamptz NOT NULL,
    CONSTRAINT ""PK_AprovadoresAlternativos"" PRIMARY KEY (""Id""),
    CONSTRAINT ""FK_AprovadoresAlternativos_Gestor""
        FOREIGN KEY (""GestorId"") REFERENCES ""Funcionarios""(""Id"") ON DELETE CASCADE,
    CONSTRAINT ""FK_AprovadoresAlternativos_Aprovador""
        FOREIGN KEY (""AprovadorId"") REFERENCES ""Funcionarios""(""Id"") ON DELETE CASCADE
);

END $$;

CREATE INDEX IF NOT EXISTS ""IX_AprovadoresAlternativos_TenantGestor""
    ON ""AprovadoresAlternativos"" (""TenantId"", ""GestorId"");
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TABLE IF EXISTS ""AprovadoresAlternativos"";
");
        }
    }
}
