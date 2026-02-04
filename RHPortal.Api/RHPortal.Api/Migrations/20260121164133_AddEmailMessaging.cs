using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailMessaging : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmailMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    OwnerUserId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    OwnerUserName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    IsSystem = table.Column<bool>(type: "boolean", nullable: false),
                    Source = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    To = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    Cc = table.Column<string>(type: "character varying(640)", maxLength: 640, nullable: true),
                    Bcc = table.Column<string>(type: "character varying(640)", maxLength: 640, nullable: true),
                    Subject = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    BodyHtml = table.Column<string>(type: "text", nullable: false),
                    BodyText = table.Column<string>(type: "text", nullable: true),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: true),
                    TemplateName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    TemplateVersion = table.Column<int>(type: "integer", nullable: true),
                    PayloadJson = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AttemptCount = table.Column<int>(type: "integer", nullable: false),
                    MaxAttempts = table.Column<int>(type: "integer", nullable: false),
                    NextAttemptAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailMessages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EmailTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    SubjectTemplate = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BodyHtml = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EmailAttempts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    EmailMessageId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptNumber = table.Column<int>(type: "integer", nullable: false),
                    Provider = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    StartedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CompletedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IsSuccess = table.Column<bool>(type: "boolean", nullable: false),
                    ErrorMessage = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: true),
                    ErrorStackTrace = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailAttempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmailAttempts_EmailMessages_EmailMessageId",
                        column: x => x.EmailMessageId,
                        principalTable: "EmailMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmailAttempts_EmailMessageId",
                table: "EmailAttempts",
                column: "EmailMessageId");

            migrationBuilder.CreateIndex(
                name: "IX_EmailAttempts_TenantId_EmailMessageId",
                table: "EmailAttempts",
                columns: new[] { "TenantId", "EmailMessageId" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailAttempts_TenantId_StartedAtUtc",
                table: "EmailAttempts",
                columns: new[] { "TenantId", "StartedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailMessages_TenantId_CreatedAtUtc",
                table: "EmailMessages",
                columns: new[] { "TenantId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailMessages_TenantId_IsSystem",
                table: "EmailMessages",
                columns: new[] { "TenantId", "IsSystem" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailMessages_TenantId_OwnerUserId",
                table: "EmailMessages",
                columns: new[] { "TenantId", "OwnerUserId" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailMessages_TenantId_Status",
                table: "EmailMessages",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailTemplates_TenantId_Name_IsActive",
                table: "EmailTemplates",
                columns: new[] { "TenantId", "Name", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailTemplates_TenantId_Name_Version",
                table: "EmailTemplates",
                columns: new[] { "TenantId", "Name", "Version" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmailAttempts");

            migrationBuilder.DropTable(
                name: "EmailTemplates");

            migrationBuilder.DropTable(
                name: "EmailMessages");
        }
    }
}
