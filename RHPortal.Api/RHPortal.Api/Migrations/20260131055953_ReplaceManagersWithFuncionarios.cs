using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceManagersWithFuncionarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Create Funcionarios table (UserId column without FK to Users yet - avoid circular ref)
            migrationBuilder.CreateTable(
                name: "Funcionarios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Headcount = table.Column<int>(type: "integer", nullable: false),
                    JobPositionId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Funcionarios", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Funcionarios_Areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "Areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Funcionarios_JobPositions_JobPositionId",
                        column: x => x.JobPositionId,
                        principalTable: "JobPositions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Funcionarios_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_AreaId",
                table: "Funcionarios",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_JobPositionId",
                table: "Funcionarios",
                column: "JobPositionId");

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_TenantId_Email",
                table: "Funcionarios",
                columns: new[] { "TenantId", "Email" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_UnitId",
                table: "Funcionarios",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_UserId",
                table: "Funcionarios",
                column: "UserId");

            // 2. Copy data from Managers to Funcionarios (preserve Id for FK mapping)
            migrationBuilder.Sql(@"
                INSERT INTO ""Funcionarios"" (""Id"", ""TenantId"", ""Name"", ""Email"", ""Phone"", ""Status"", ""UserId"", ""UnitId"", ""AreaId"", ""Headcount"", ""JobPositionId"", ""Notes"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                SELECT ""Id"", ""TenantId"", ""Name"", ""Email"", ""Phone"", ""Status"", NULL, ""UnitId"", ""AreaId"", ""Headcount"", ""JobPositionId"", ""Notes"", ""CreatedAtUtc"", ""UpdatedAtUtc""
                FROM ""Managers""");

            // 3. Add FuncionarioId to Users
            migrationBuilder.AddColumn<Guid>(
                name: "FuncionarioId",
                table: "Users",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_FuncionarioId",
                table: "Users",
                column: "FuncionarioId");

            // 4. Copy User.ManagerId -> User.FuncionarioId
            migrationBuilder.Sql(@"UPDATE ""Users"" SET ""FuncionarioId"" = ""ManagerId"" WHERE ""ManagerId"" IS NOT NULL");

            // 5. Set Funcionarios.UserId from Users that point to this Funcionario
            migrationBuilder.Sql(@"UPDATE ""Funcionarios"" f SET ""UserId"" = u.""Id"" FROM ""Users"" u WHERE u.""FuncionarioId"" = f.""Id""");

            // 6. Add FK Funcionarios.UserId -> Users
            migrationBuilder.AddForeignKey(
                name: "FK_Funcionarios_Users_UserId",
                table: "Funcionarios",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // 7. Add OwnerFuncionarioId to Areas
            migrationBuilder.AddColumn<Guid>(
                name: "OwnerFuncionarioId",
                table: "Areas",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Areas_OwnerFuncionarioId",
                table: "Areas",
                column: "OwnerFuncionarioId");

            // 8. Copy Area.OwnerManagerId -> Area.OwnerFuncionarioId
            migrationBuilder.Sql(@"UPDATE ""Areas"" SET ""OwnerFuncionarioId"" = ""OwnerManagerId"" WHERE ""OwnerManagerId"" IS NOT NULL");

            // 9. Drop Users -> Managers FK and column
            migrationBuilder.DropForeignKey(
                name: "FK_Users_Managers_ManagerId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_ManagerId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ManagerId",
                table: "Users");

            // 10. Drop Areas -> Managers FK and column
            migrationBuilder.DropForeignKey(
                name: "FK_Areas_Managers_OwnerManagerId",
                table: "Areas");

            migrationBuilder.DropIndex(
                name: "IX_Areas_OwnerManagerId",
                table: "Areas");

            migrationBuilder.DropColumn(
                name: "OwnerManagerId",
                table: "Areas");

            // 11. Drop Managers table
            migrationBuilder.DropTable(
                name: "Managers");

            // 12. Add FK Users.FuncionarioId -> Funcionarios
            migrationBuilder.AddForeignKey(
                name: "FK_Users_Funcionarios_FuncionarioId",
                table: "Users",
                column: "FuncionarioId",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // 13. Add FK Areas.OwnerFuncionarioId -> Funcionarios
            migrationBuilder.AddForeignKey(
                name: "FK_Areas_Funcionarios_OwnerFuncionarioId",
                table: "Areas",
                column: "OwnerFuncionarioId",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Areas_Funcionarios_OwnerFuncionarioId",
                table: "Areas");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Funcionarios_FuncionarioId",
                table: "Users");

            migrationBuilder.DropTable(
                name: "Funcionarios");

            migrationBuilder.DropColumn(
                name: "FuncionarioId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "OwnerFuncionarioId",
                table: "Areas");

            migrationBuilder.CreateTable(
                name: "Managers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: false),
                    JobPositionId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Headcount = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Managers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Managers_Areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "Areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Managers_JobPositions_JobPositionId",
                        column: x => x.JobPositionId,
                        principalTable: "JobPositions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Managers_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Managers_AreaId",
                table: "Managers",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_Managers_JobPositionId",
                table: "Managers",
                column: "JobPositionId");

            migrationBuilder.CreateIndex(
                name: "IX_Managers_TenantId_Email",
                table: "Managers",
                columns: new[] { "TenantId", "Email" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Managers_UnitId",
                table: "Managers",
                column: "UnitId");

            migrationBuilder.AddColumn<Guid>(
                name: "ManagerId",
                table: "Users",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerManagerId",
                table: "Areas",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_ManagerId",
                table: "Users",
                column: "ManagerId");

            migrationBuilder.CreateIndex(
                name: "IX_Areas_OwnerManagerId",
                table: "Areas",
                column: "OwnerManagerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Areas_Managers_OwnerManagerId",
                table: "Areas",
                column: "OwnerManagerId",
                principalTable: "Managers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Managers_ManagerId",
                table: "Users",
                column: "ManagerId",
                principalTable: "Managers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
