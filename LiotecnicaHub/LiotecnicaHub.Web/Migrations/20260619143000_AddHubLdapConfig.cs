using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LiotecnicaHub.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddHubLdapConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "HubLdapConfigs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    Server = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Port = table.Column<int>(type: "integer", nullable: false),
                    UseSsl = table.Column<bool>(type: "boolean", nullable: false),
                    UseStartTls = table.Column<bool>(type: "boolean", nullable: false),
                    SkipServerCertificateValidation = table.Column<bool>(type: "boolean", nullable: false),
                    BaseDn = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    UserSearchBase = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Domain = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    LoginIdentityMode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    BindDn = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    BindPasswordProtected = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    SearchFilterTemplate = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    DisplayNameAttribute = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubLdapConfigs", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HubLdapConfigs");
        }
    }
}
