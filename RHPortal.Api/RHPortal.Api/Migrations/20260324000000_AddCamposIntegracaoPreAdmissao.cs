using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCamposIntegracaoPreAdmissao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'IntegracaoResultado') THEN
                        ALTER TABLE "PreAdmissoes" ADD "IntegracaoResultado" smallint;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'IntegracaoMensagem') THEN
                        ALTER TABLE "PreAdmissoes" ADD "IntegracaoMensagem" character varying(2000);
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'IntegradaEmUtc') THEN
                        ALTER TABLE "PreAdmissoes" ADD "IntegradaEmUtc" timestamp with time zone;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "IntegradaEmUtc",      table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "IntegracaoMensagem",  table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "IntegracaoResultado", table: "PreAdmissoes");
        }
    }
}
