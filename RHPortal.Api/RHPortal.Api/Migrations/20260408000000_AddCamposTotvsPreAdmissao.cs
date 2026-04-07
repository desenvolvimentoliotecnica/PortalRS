using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCamposTotvsPreAdmissao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── Campos integração TOTVS (trabalhistas) ──

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'CodCargoTotvs') THEN
                        ALTER TABLE "PreAdmissoes" ADD "CodCargoTotvs" integer;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'CodVinculoEmpregaticio') THEN
                        ALTER TABLE "PreAdmissoes" ADD "CodVinculoEmpregaticio" integer;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'TipoFuncionario') THEN
                        ALTER TABLE "PreAdmissoes" ADD "TipoFuncionario" integer;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'CategoriaSalarial') THEN
                        ALTER TABLE "PreAdmissoes" ADD "CategoriaSalarial" integer;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'GrauInstrucao') THEN
                        ALTER TABLE "PreAdmissoes" ADD "GrauInstrucao" integer;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'CodTurno') THEN
                        ALTER TABLE "PreAdmissoes" ADD "CodTurno" integer;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'CentroCusto') THEN
                        ALTER TABLE "PreAdmissoes" ADD "CentroCusto" character varying(30);
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'UnidadeLotacao') THEN
                        ALTER TABLE "PreAdmissoes" ADD "UnidadeLotacao" character varying(30);
                    END IF;
                END $$;
                """);

            // ── Saúde e docs complementares TOTVS ──

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'GrupoSanguineo') THEN
                        ALTER TABLE "PreAdmissoes" ADD "GrupoSanguineo" integer;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'FatorRh') THEN
                        ALTER TABLE "PreAdmissoes" ADD "FatorRh" integer;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'PossuiDeficiencia') THEN
                        ALTER TABLE "PreAdmissoes" ADD "PossuiDeficiencia" character varying(1);
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'DocMilitarTipo') THEN
                        ALTER TABLE "PreAdmissoes" ADD "DocMilitarTipo" integer;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'DocMilitarNumero') THEN
                        ALTER TABLE "PreAdmissoes" ADD "DocMilitarNumero" character varying(30);
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'DocMilitarSerie') THEN
                        ALTER TABLE "PreAdmissoes" ADD "DocMilitarSerie" character varying(20);
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'DocMilitarRegiao') THEN
                        ALTER TABLE "PreAdmissoes" ADD "DocMilitarRegiao" integer;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'CartaoSus') THEN
                        ALTER TABLE "PreAdmissoes" ADD "CartaoSus" character varying(30);
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'TituloEleitorCidade') THEN
                        ALTER TABLE "PreAdmissoes" ADD "TituloEleitorCidade" character varying(120);
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'TituloEleitorUf') THEN
                        ALTER TABLE "PreAdmissoes" ADD "TituloEleitorUf" character varying(2);
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'CtpsModelo') THEN
                        ALTER TABLE "PreAdmissoes" ADD "CtpsModelo" integer;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'Altura') THEN
                        ALTER TABLE "PreAdmissoes" ADD "Altura" integer;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes' AND column_name = 'Peso') THEN
                        ALTER TABLE "PreAdmissoes" ADD "Peso" integer;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "CodCargoTotvs",          table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "CodVinculoEmpregaticio", table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "TipoFuncionario",        table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "CategoriaSalarial",       table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "GrauInstrucao",           table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "CodTurno",                table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "CentroCusto",             table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "UnidadeLotacao",          table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "GrupoSanguineo",          table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "FatorRh",                 table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "PossuiDeficiencia",       table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "DocMilitarTipo",          table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "DocMilitarNumero",        table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "DocMilitarSerie",         table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "DocMilitarRegiao",        table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "CartaoSus",               table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "TituloEleitorCidade",     table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "TituloEleitorUf",         table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "CtpsModelo",              table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "Altura",                  table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "Peso",                    table: "PreAdmissoes");
        }
    }
}
