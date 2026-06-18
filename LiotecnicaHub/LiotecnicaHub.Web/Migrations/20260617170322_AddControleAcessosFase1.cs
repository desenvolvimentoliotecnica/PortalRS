using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LiotecnicaHub.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddControleAcessosFase1 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SystemId",
                table: "HubApplications",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "HubAccessAudits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AffectedUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProfileId = table.Column<Guid>(type: "uuid", nullable: true),
                    SystemId = table.Column<Guid>(type: "uuid", nullable: true),
                    PermissionId = table.Column<Guid>(type: "uuid", nullable: true),
                    Action = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Justification = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ChangedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    OccurredAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    PreviousData = table.Column<string>(type: "text", nullable: true),
                    NewData = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubAccessAudits", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HubAccessScopes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ScopeType = table.Column<int>(type: "integer", nullable: false),
                    ExternalCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubAccessScopes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HubProfiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubProfiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HubSystems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IconKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    RequiresApproval = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubSystems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HubUsers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubUsers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HubSystemModules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SystemId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubSystemModules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HubSystemModules_HubSystems_SystemId",
                        column: x => x.SystemId,
                        principalTable: "HubSystems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HubUserProfiles",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubUserProfiles", x => new { x.UserId, x.ProfileId });
                    table.ForeignKey(
                        name: "FK_HubUserProfiles_HubProfiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "HubProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HubUserProfiles_HubUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "HubUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HubUserProfileScopes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScopeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubUserProfileScopes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HubUserProfileScopes_HubAccessScopes_ScopeId",
                        column: x => x.ScopeId,
                        principalTable: "HubAccessScopes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HubUserProfileScopes_HubProfiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "HubProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HubUserProfileScopes_HubUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "HubUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HubPermissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SystemId = table.Column<Guid>(type: "uuid", nullable: false),
                    ModuleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Code = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubPermissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HubPermissions_HubSystemModules_ModuleId",
                        column: x => x.ModuleId,
                        principalTable: "HubSystemModules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HubPermissions_HubSystems_SystemId",
                        column: x => x.SystemId,
                        principalTable: "HubSystems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HubProfilePermissions",
                columns: table => new
                {
                    ProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    PermissionId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HubProfilePermissions", x => new { x.ProfileId, x.PermissionId });
                    table.ForeignKey(
                        name: "FK_HubProfilePermissions_HubPermissions_PermissionId",
                        column: x => x.PermissionId,
                        principalTable: "HubPermissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HubProfilePermissions_HubProfiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "HubProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_HubApplications_SystemId",
                table: "HubApplications",
                column: "SystemId");

            migrationBuilder.CreateIndex(
                name: "IX_HubAccessAudits_OccurredAtUtc",
                table: "HubAccessAudits",
                column: "OccurredAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_HubAccessScopes_ScopeType_ExternalCode",
                table: "HubAccessScopes",
                columns: new[] { "ScopeType", "ExternalCode" });

            migrationBuilder.CreateIndex(
                name: "IX_HubPermissions_Code",
                table: "HubPermissions",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HubPermissions_ModuleId",
                table: "HubPermissions",
                column: "ModuleId");

            migrationBuilder.CreateIndex(
                name: "IX_HubPermissions_SystemId",
                table: "HubPermissions",
                column: "SystemId");

            migrationBuilder.CreateIndex(
                name: "IX_HubProfilePermissions_PermissionId",
                table: "HubProfilePermissions",
                column: "PermissionId");

            migrationBuilder.CreateIndex(
                name: "IX_HubProfiles_Code",
                table: "HubProfiles",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HubSystemModules_SystemId_Code",
                table: "HubSystemModules",
                columns: new[] { "SystemId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HubSystems_Code",
                table: "HubSystems",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HubUserProfiles_ProfileId",
                table: "HubUserProfiles",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_HubUserProfileScopes_ProfileId",
                table: "HubUserProfileScopes",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_HubUserProfileScopes_ScopeId",
                table: "HubUserProfileScopes",
                column: "ScopeId");

            migrationBuilder.CreateIndex(
                name: "IX_HubUserProfileScopes_UserId",
                table: "HubUserProfileScopes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_HubUsers_Email",
                table: "HubUsers",
                column: "Email",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_HubApplications_HubSystems_SystemId",
                table: "HubApplications",
                column: "SystemId",
                principalTable: "HubSystems",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_HubApplications_HubSystems_SystemId",
                table: "HubApplications");

            migrationBuilder.DropTable(
                name: "HubAccessAudits");

            migrationBuilder.DropTable(
                name: "HubProfilePermissions");

            migrationBuilder.DropTable(
                name: "HubUserProfiles");

            migrationBuilder.DropTable(
                name: "HubUserProfileScopes");

            migrationBuilder.DropTable(
                name: "HubPermissions");

            migrationBuilder.DropTable(
                name: "HubAccessScopes");

            migrationBuilder.DropTable(
                name: "HubProfiles");

            migrationBuilder.DropTable(
                name: "HubUsers");

            migrationBuilder.DropTable(
                name: "HubSystemModules");

            migrationBuilder.DropTable(
                name: "HubSystems");

            migrationBuilder.DropIndex(
                name: "IX_HubApplications_SystemId",
                table: "HubApplications");

            migrationBuilder.DropColumn(
                name: "SystemId",
                table: "HubApplications");
        }
    }
}
