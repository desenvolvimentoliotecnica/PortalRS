using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidatoStatusHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CandidatoStatusHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromStatus = table.Column<int>(type: "integer", nullable: false),
                    ToStatus = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Note = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Source = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    UserId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    UserName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoStatusHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidatoStatusHistories_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoStatusHistories_CandidatoId",
                table: "CandidatoStatusHistories",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoStatusHistories_TenantId_CandidatoId",
                table: "CandidatoStatusHistories",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoStatusHistories_TenantId_CandidatoId_CreatedAtUtc",
                table: "CandidatoStatusHistories",
                columns: new[] { "TenantId", "CandidatoId", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidatoStatusHistories");
        }
    }
}
