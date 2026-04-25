using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AlterCnhDatasParaDateOnly : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente + multi-tenant: só altera se a coluna ainda for integer.
            // Preserva valores no formato AAAAMMDD (ex.: 20240115 → 2024-01-15);
            // zera o restante para evitar 22007 invalid_datetime_format.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes'
                          AND column_name = 'CnhPrimeiraHabilitacao'
                          AND data_type = 'integer'
                    ) THEN
                        ALTER TABLE "PreAdmissoes"
                            ALTER COLUMN "CnhPrimeiraHabilitacao" TYPE date
                            USING CASE
                                WHEN "CnhPrimeiraHabilitacao" IS NULL OR "CnhPrimeiraHabilitacao" = 0 THEN NULL
                                WHEN "CnhPrimeiraHabilitacao" BETWEEN 19000101 AND 21001231
                                    THEN to_date("CnhPrimeiraHabilitacao"::text, 'YYYYMMDD')
                                ELSE NULL
                            END;
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes'
                          AND column_name = 'CnhDataExpedicao'
                          AND data_type = 'integer'
                    ) THEN
                        ALTER TABLE "PreAdmissoes"
                            ALTER COLUMN "CnhDataExpedicao" TYPE date
                            USING CASE
                                WHEN "CnhDataExpedicao" IS NULL OR "CnhDataExpedicao" = 0 THEN NULL
                                WHEN "CnhDataExpedicao" BETWEEN 19000101 AND 21001231
                                    THEN to_date("CnhDataExpedicao"::text, 'YYYYMMDD')
                                ELSE NULL
                            END;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes'
                          AND column_name = 'CnhPrimeiraHabilitacao'
                          AND data_type = 'date'
                    ) THEN
                        ALTER TABLE "PreAdmissoes"
                            ALTER COLUMN "CnhPrimeiraHabilitacao" TYPE integer
                            USING CASE
                                WHEN "CnhPrimeiraHabilitacao" IS NULL THEN NULL
                                ELSE (to_char("CnhPrimeiraHabilitacao", 'YYYYMMDD'))::integer
                            END;
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes'
                          AND column_name = 'CnhDataExpedicao'
                          AND data_type = 'date'
                    ) THEN
                        ALTER TABLE "PreAdmissoes"
                            ALTER COLUMN "CnhDataExpedicao" TYPE integer
                            USING CASE
                                WHEN "CnhDataExpedicao" IS NULL THEN NULL
                                ELSE (to_char("CnhDataExpedicao", 'YYYYMMDD'))::integer
                            END;
                    END IF;
                END $$;
                """);
        }
    }
}
