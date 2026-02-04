using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations.Master
{
    /// <inheritdoc />
    public partial class AddAiModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AiProviderKeys",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Provider = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    EncryptedKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiProviderKeys", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AiModels",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AiProviderKeyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ModelId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiModels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AiModels_AiProviderKeys_AiProviderKeyId",
                        column: x => x.AiProviderKeyId,
                        principalTable: "AiProviderKeys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AiUsageRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UserName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Module = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    AiModelId = table.Column<Guid>(type: "uuid", nullable: false),
                    Cost = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    ActionDescription = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RequestMessage = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiUsageRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AiUsageRecords_AiModels_AiModelId",
                        column: x => x.AiModelId,
                        principalTable: "AiModels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AiModels_AiProviderKeyId",
                table: "AiModels",
                column: "AiProviderKeyId");

            migrationBuilder.CreateIndex(
                name: "IX_AiUsageRecords_AiModelId",
                table: "AiUsageRecords",
                column: "AiModelId");

            migrationBuilder.CreateIndex(
                name: "IX_AiUsageRecords_CreatedAtUtc",
                table: "AiUsageRecords",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_AiUsageRecords_Module",
                table: "AiUsageRecords",
                column: "Module");

            migrationBuilder.CreateIndex(
                name: "IX_AiUsageRecords_TenantId",
                table: "AiUsageRecords",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_AiUsageRecords_UserId",
                table: "AiUsageRecords",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AiUsageRecords");

            migrationBuilder.DropTable(
                name: "AiModels");

            migrationBuilder.DropTable(
                name: "AiProviderKeys");
        }
    }
}
