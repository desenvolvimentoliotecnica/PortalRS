using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <summary>
    /// Preenche TenantId em Candidatos, CandidatoDocumentos e CandidatoStatusHistories
    /// que estavam vazios/null (causando lista de candidatos vazia pelo filtro global).
    /// Usa 'liotecnica' como tenant padrão para dados existentes; se o ambiente usar
    /// outro tenant id, execute manualmente: UPDATE "Candidatos" SET "TenantId" = 'seu-tenant'
    /// WHERE "TenantId" = 'liotecnica' (e o mesmo para CandidatoDocumentos/CandidatoStatusHistories).
    /// </summary>
    [Migration("20260211150000_BackfillCandidatosTenantId")]
    public partial class BackfillCandidatosTenantId : Migration
    {
        private const string DefaultTenantId = "liotecnica";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                UPDATE ""Candidatos""
                SET ""TenantId"" = '{DefaultTenantId}'
                WHERE ""TenantId"" IS NULL OR TRIM(""TenantId"") = '';
            ");
            migrationBuilder.Sql($@"
                UPDATE ""CandidatoDocumentos""
                SET ""TenantId"" = '{DefaultTenantId}'
                WHERE ""TenantId"" IS NULL OR TRIM(""TenantId"") = '';
            ");
            migrationBuilder.Sql($@"
                UPDATE ""CandidatoStatusHistories""
                SET ""TenantId"" = '{DefaultTenantId}'
                WHERE ""TenantId"" IS NULL OR TRIM(""TenantId"") = '';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Não reverte dados; seria inseguro alterar de volta para vazio.
        }
    }
}
