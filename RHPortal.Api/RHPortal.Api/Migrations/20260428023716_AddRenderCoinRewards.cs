using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRenderCoinRewards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "RenderCoinRewards" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "Codigo" character varying(64) NOT NULL,
                    "Nome" character varying(200) NOT NULL,
                    "Descricao" character varying(2000) NULL,
                    "Categoria" character varying(64) NULL,
                    "CustoCoins" numeric(18,2) NOT NULL,
                    "EstoqueDisponivel" integer NULL,
                    "ImagemUrl" character varying(500) NULL,
                    "IsSystem" boolean NOT NULL,
                    "IsActive" boolean NOT NULL,
                    "Ordem" integer NOT NULL,
                    "CriadoEmUtc" timestamp with time zone NOT NULL,
                    "AtualizadoEmUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_RenderCoinRewards" PRIMARY KEY ("Id")
                );

                CREATE TABLE IF NOT EXISTS "RenderCoinRedemptions" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "RewardId" uuid NOT NULL,
                    "UserId" uuid NOT NULL,
                    "CoinsGastos" numeric(18,2) NOT NULL,
                    "Status" integer NOT NULL,
                    "Observacao" character varying(2000) NULL,
                    "ProcessadoPorUserId" uuid NULL,
                    "ProcessadoEmUtc" timestamp with time zone NULL,
                    "CriadoEmUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_RenderCoinRedemptions" PRIMARY KEY ("Id")
                );

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_RenderCoinRedemptions_RenderCoinRewards_RewardId') THEN
                        ALTER TABLE "RenderCoinRedemptions"
                            ADD CONSTRAINT "FK_RenderCoinRedemptions_RenderCoinRewards_RewardId"
                            FOREIGN KEY ("RewardId") REFERENCES "RenderCoinRewards" ("Id") ON DELETE RESTRICT;
                    END IF;
                END $$;

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_RenderCoinRedemptions_Users_UserId') THEN
                        ALTER TABLE "RenderCoinRedemptions"
                            ADD CONSTRAINT "FK_RenderCoinRedemptions_Users_UserId"
                            FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT;
                    END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS "IX_RenderCoinRedemptions_RewardId"
                    ON "RenderCoinRedemptions" ("RewardId");
                CREATE INDEX IF NOT EXISTS "IX_RenderCoinRedemptions_UserId"
                    ON "RenderCoinRedemptions" ("UserId");
                CREATE INDEX IF NOT EXISTS "IX_RenderCoinRedemptions_TenantId_RewardId"
                    ON "RenderCoinRedemptions" ("TenantId", "RewardId");
                CREATE INDEX IF NOT EXISTS "IX_RenderCoinRedemptions_TenantId_UserId_Status"
                    ON "RenderCoinRedemptions" ("TenantId", "UserId", "Status");

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_RenderCoinRewards_TenantId_Codigo"
                    ON "RenderCoinRewards" ("TenantId", "Codigo");
                CREATE INDEX IF NOT EXISTS "IX_RenderCoinRewards_TenantId_IsActive"
                    ON "RenderCoinRewards" ("TenantId", "IsActive");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "RenderCoinRedemptions";
                DROP TABLE IF EXISTS "RenderCoinRewards";
                """);
        }
    }
}
