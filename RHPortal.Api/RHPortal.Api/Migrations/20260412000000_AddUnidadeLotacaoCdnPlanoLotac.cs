using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260412000000_AddUnidadeLotacaoCdnPlanoLotac")]
    public partial class AddUnidadeLotacaoCdnPlanoLotac : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN

-- Adiciona coluna CdnPlanoLotac com default '101' (plano que estava hardcoded nos scripts)
ALTER TABLE ""UnidadesLotacao""
    ADD COLUMN IF NOT EXISTS ""CdnPlanoLotac"" character varying(10) NOT NULL DEFAULT '101';

-- Remove o default após backfill (novos registros devem fornecer o valor explicitamente)
ALTER TABLE ""UnidadesLotacao""
    ALTER COLUMN ""CdnPlanoLotac"" DROP DEFAULT;

-- Troca o índice único: apenas Code → CdnPlanoLotac + Code
DROP INDEX IF EXISTS ""IX_UnidadesLotacao_TenantId_Code"";

CREATE UNIQUE INDEX ""IX_UnidadesLotacao_TenantId_CdnPlanoLotac_Code""
    ON ""UnidadesLotacao"" (""TenantId"", ""CdnPlanoLotac"", ""Code"");

END $$;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN

DROP INDEX IF EXISTS ""IX_UnidadesLotacao_TenantId_CdnPlanoLotac_Code"";

CREATE UNIQUE INDEX ""IX_UnidadesLotacao_TenantId_Code""
    ON ""UnidadesLotacao"" (""TenantId"", ""Code"");

ALTER TABLE ""UnidadesLotacao"" DROP COLUMN IF EXISTS ""CdnPlanoLotac"";

END $$;
");
        }
    }
}
