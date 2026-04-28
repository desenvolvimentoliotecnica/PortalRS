using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentosLuc122ToPessoa : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente (CLAUDE.md): colunas podem já existir em tenants antigos.
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""Sexo"" character varying(1) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""EstadoCivil"" character varying(2) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""Naturalidade"" character varying(120) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""EstadoNatal"" character varying(2) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""GrauInstrucao"" character varying(5) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""RgOrgEmissor"" character varying(20) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""RgUf"" character varying(2) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""RgDataEmissao"" timestamp with time zone NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""CarteiraTrabalho"" character varying(20) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""CarteiraTrabalhoSerie"" character varying(10) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""CarteiraTrabalhoUf"" character varying(2) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""CarteiraTrabalhoData"" timestamp with time zone NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""NumeroPis"" character varying(20) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""TituloEleitor"" character varying(20) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""TituloEleitorZona"" character varying(10) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""TituloEleitorSecao"" character varying(10) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""CertificadoReservista"" character varying(20) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""CategoriaMilitar"" character varying(2) NULL;");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Pessoas_TenantId_Cpf"" ON ""Pessoas"" (""TenantId"", ""Cpf"");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_Pessoas_TenantId_Cpf", table: "Pessoas");
            foreach (var col in new[] { "Sexo","EstadoCivil","Naturalidade","EstadoNatal","GrauInstrucao",
                "RgOrgEmissor","RgUf","RgDataEmissao","CarteiraTrabalho","CarteiraTrabalhoSerie",
                "CarteiraTrabalhoUf","CarteiraTrabalhoData","NumeroPis","TituloEleitor",
                "TituloEleitorZona","TituloEleitorSecao","CertificadoReservista","CategoriaMilitar" })
            {
                migrationBuilder.DropColumn(name: col, table: "Pessoas");
            }
        }
    }
}
