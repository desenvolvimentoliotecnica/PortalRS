using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAgendaEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AgendaEventTypes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Label = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Color = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Icon = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgendaEventTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AgendaEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    StartAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AllDay = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Location = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Owner = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Candidate = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    VagaTitle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    VagaCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgendaEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgendaEvents_AgendaEventTypes_TypeId",
                        column: x => x.TypeId,
                        principalTable: "AgendaEventTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AgendaEvents_TenantId_StartAtUtc",
                table: "AgendaEvents",
                columns: new[] { "TenantId", "StartAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_AgendaEvents_TypeId",
                table: "AgendaEvents",
                column: "TypeId");

            migrationBuilder.CreateIndex(
                name: "IX_AgendaEventTypes_TenantId_Code",
                table: "AgendaEventTypes",
                columns: new[] { "TenantId", "Code" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AgendaEvents");

            migrationBuilder.DropTable(
                name: "AgendaEventTypes");
        }
    }
}
