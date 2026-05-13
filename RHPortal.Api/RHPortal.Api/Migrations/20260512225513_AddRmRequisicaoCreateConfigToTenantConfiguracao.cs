using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRmRequisicaoCreateConfigToTenantConfiguracao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                ADD COLUMN IF NOT EXISTS "RmRequisicaoCreateEndpointUrl" character varying(1000) NULL;

                ALTER TABLE "TenantConfiguracoes"
                ADD COLUMN IF NOT EXISTS "RmRequisicaoCreatePassword" character varying(500) NULL;

                ALTER TABLE "TenantConfiguracoes"
                ADD COLUMN IF NOT EXISTS "RmRequisicaoCreateUsername" character varying(200) NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                DROP COLUMN IF EXISTS "RmRequisicaoCreateEndpointUrl";

                ALTER TABLE "TenantConfiguracoes"
                DROP COLUMN IF EXISTS "RmRequisicaoCreatePassword";

                ALTER TABLE "TenantConfiguracoes"
                DROP COLUMN IF EXISTS "RmRequisicaoCreateUsername";
                """);
        }
    }
}
