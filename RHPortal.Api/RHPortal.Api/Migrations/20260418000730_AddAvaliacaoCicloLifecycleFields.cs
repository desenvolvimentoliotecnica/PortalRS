using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAvaliacaoCicloLifecycleFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "AvaliacaoCiclos" ADD COLUMN IF NOT EXISTS "DataFim" date NULL;
                ALTER TABLE "AvaliacaoCiclos" ADD COLUMN IF NOT EXISTS "DataInicio" date NULL;
                ALTER TABLE "AvaliacaoCiclos" ADD COLUMN IF NOT EXISTS "Descricao" character varying(2000) NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "AvaliacaoCiclos" DROP COLUMN IF EXISTS "DataFim";
                ALTER TABLE "AvaliacaoCiclos" DROP COLUMN IF EXISTS "DataInicio";
                ALTER TABLE "AvaliacaoCiclos" DROP COLUMN IF EXISTS "Descricao";
                """);
        }
    }
}
