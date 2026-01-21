using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmailConfigs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Provider = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SmtpHost = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SmtpPort = table.Column<int>(type: "integer", nullable: false),
                    SmtpEnableSsl = table.Column<bool>(type: "boolean", nullable: false),
                    SmtpUserName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SmtpPasswordEncrypted = table.Column<string>(type: "text", nullable: true),
                    SmtpFromName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SmtpFromAddress = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ImapHost = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ImapPort = table.Column<int>(type: "integer", nullable: false),
                    ImapEnableSsl = table.Column<bool>(type: "boolean", nullable: false),
                    ImapUserName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ImapPasswordEncrypted = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailConfigs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmailConfigs_TenantId",
                table: "EmailConfigs",
                column: "TenantId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmailConfigs");
        }
    }
}
