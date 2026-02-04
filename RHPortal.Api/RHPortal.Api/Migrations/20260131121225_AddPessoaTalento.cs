using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPessoaTalento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PessoaId",
                table: "Funcionarios",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TalentoId",
                table: "Candidatos",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Pessoas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Fone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Cidade = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Uf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    LinkedinUrl = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    ResumoProfissional = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Obs = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pessoas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Talentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PessoaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Origem = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Talentos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Talentos_Pessoas_PessoaId",
                        column: x => x.PessoaId,
                        principalTable: "Pessoas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_PessoaId",
                table: "Funcionarios",
                column: "PessoaId");

            migrationBuilder.CreateIndex(
                name: "IX_Candidatos_TalentoId",
                table: "Candidatos",
                column: "TalentoId");

            migrationBuilder.CreateIndex(
                name: "IX_Pessoas_TenantId_Email",
                table: "Pessoas",
                columns: new[] { "TenantId", "Email" });

            migrationBuilder.CreateIndex(
                name: "IX_Talentos_PessoaId",
                table: "Talentos",
                column: "PessoaId");

            migrationBuilder.CreateIndex(
                name: "IX_Talentos_TenantId_PessoaId",
                table: "Talentos",
                columns: new[] { "TenantId", "PessoaId" });

            migrationBuilder.AddForeignKey(
                name: "FK_Candidatos_Talentos_TalentoId",
                table: "Candidatos",
                column: "TalentoId",
                principalTable: "Talentos",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Funcionarios_Pessoas_PessoaId",
                table: "Funcionarios",
                column: "PessoaId",
                principalTable: "Pessoas",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Candidatos_Talentos_TalentoId",
                table: "Candidatos");

            migrationBuilder.DropForeignKey(
                name: "FK_Funcionarios_Pessoas_PessoaId",
                table: "Funcionarios");

            migrationBuilder.DropTable(
                name: "Talentos");

            migrationBuilder.DropTable(
                name: "Pessoas");

            migrationBuilder.DropIndex(
                name: "IX_Funcionarios_PessoaId",
                table: "Funcionarios");

            migrationBuilder.DropIndex(
                name: "IX_Candidatos_TalentoId",
                table: "Candidatos");

            migrationBuilder.DropColumn(
                name: "PessoaId",
                table: "Funcionarios");

            migrationBuilder.DropColumn(
                name: "TalentoId",
                table: "Candidatos");
        }
    }
}
