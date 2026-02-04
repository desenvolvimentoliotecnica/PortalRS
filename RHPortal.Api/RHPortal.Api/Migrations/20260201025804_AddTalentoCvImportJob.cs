using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTalentoCvImportJob : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TalentoCvImportJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TalentoId = table.Column<Guid>(type: "uuid", nullable: false),
                    TalentoDocumentoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    EnviarParaGpt = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    StartedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    FinishedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    SimilarTalentoId = table.Column<Guid>(type: "uuid", nullable: true),
                    SuggestedDataJson = table.Column<string>(type: "text", nullable: true),
                    ErrorMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TalentoCvImportJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TalentoCvImportJobs_TalentoDocumentos_TalentoDocumentoId",
                        column: x => x.TalentoDocumentoId,
                        principalTable: "TalentoDocumentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TalentoCvImportJobs_Talentos_TalentoId",
                        column: x => x.TalentoId,
                        principalTable: "Talentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TalentoCvImportJobs_TalentoDocumentoId",
                table: "TalentoCvImportJobs",
                column: "TalentoDocumentoId");

            migrationBuilder.CreateIndex(
                name: "IX_TalentoCvImportJobs_TalentoId",
                table: "TalentoCvImportJobs",
                column: "TalentoId");

            migrationBuilder.CreateIndex(
                name: "IX_TalentoCvImportJobs_TenantId_Status",
                table: "TalentoCvImportJobs",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_TalentoCvImportJobs_TenantId_TalentoId",
                table: "TalentoCvImportJobs",
                columns: new[] { "TenantId", "TalentoId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TalentoCvImportJobs");
        }
    }
}
