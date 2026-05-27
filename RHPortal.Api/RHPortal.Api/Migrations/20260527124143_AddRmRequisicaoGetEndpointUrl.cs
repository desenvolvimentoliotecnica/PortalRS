using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRmRequisicaoGetEndpointUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                ADD COLUMN IF NOT EXISTS "RmRequisicaoGetEndpointUrl" character varying(1000) NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                DROP COLUMN IF EXISTS "RmRequisicaoGetEndpointUrl";
                """);
        }
    }
}
