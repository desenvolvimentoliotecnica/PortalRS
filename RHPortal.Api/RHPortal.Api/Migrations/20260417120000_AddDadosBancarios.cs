using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDadosBancarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "DadosBancarios" (
                    "Id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
                    "TenantId"      character varying(64)    NOT NULL,
                    "FuncionarioId" uuid                     NOT NULL,
                    "Banco"         character varying(200)   NOT NULL,
                    "Agencia"       character varying(20)    NOT NULL,
                    "Conta"         character varying(30)    NOT NULL,
                    "TipoConta"     smallint                 NOT NULL DEFAULT 0,
                    "Pix"           character varying(150)   NULL,
                    "CreatedAtUtc"  timestamp with time zone NOT NULL DEFAULT now(),
                    "UpdatedAtUtc"  timestamp with time zone NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_DadosBancarios" PRIMARY KEY ("Id")
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_DadosBancarios_TenantId_FuncionarioId"
                    ON "DadosBancarios" ("TenantId", "FuncionarioId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "DadosBancarios");
        }
    }
}
