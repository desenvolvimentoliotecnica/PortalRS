using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class Sprint1a6_HierarquiaProjetosFasesCamposComunicacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesVaga",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador1Id",
                table: "SolicitacoesVaga",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador1Status",
                table: "SolicitacoesVaga",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesVaga",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesVaga",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador2Id",
                table: "SolicitacoesVaga",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador2Status",
                table: "SolicitacoesVaga",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsConfidencial",
                table: "SolicitacoesVaga",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "SubstituidoFuncionarioId",
                table: "SolicitacoesVaga",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubstituidoNome",
                table: "SolicitacoesVaga",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "TipoSolicitacao",
                table: "SolicitacoesVaga",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<string>(
                name: "AvatarFileName",
                table: "Funcionarios",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "GestorDiretoId",
                table: "Funcionarios",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "NivelHierarquicoId",
                table: "Funcionarios",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TrabalhandoAtualmente",
                table: "Candidatos",
                type: "boolean",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CamposPersonalizadosVaga",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Tipo = table.Column<short>(type: "smallint", nullable: false),
                    Obrigatorio = table.Column<bool>(type: "boolean", nullable: false),
                    Ordem = table.Column<int>(type: "integer", nullable: false),
                    Opcoes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CamposPersonalizadosVaga", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CamposPersonalizadosVaga_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "NiveisHierarquicos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Ordem = table.Column<int>(type: "integer", nullable: false),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NiveisHierarquicos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProjetosVaga",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Numero = table.Column<int>(type: "integer", nullable: false),
                    Descricao = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjetosVaga", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjetosVaga_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FasesProcesso",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ProjetoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Ordem = table.Column<int>(type: "integer", nullable: false),
                    ResponsavelTipo = table.Column<short>(type: "smallint", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FasesProcesso", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FasesProcesso_ProjetosVaga_ProjetoId",
                        column: x => x.ProjetoId,
                        principalTable: "ProjetosVaga",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LogsComunicacao",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjetoId = table.Column<Guid>(type: "uuid", nullable: true),
                    Tipo = table.Column<short>(type: "smallint", nullable: false),
                    Assunto = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Mensagem = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Destinatario = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    UsuarioNome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LogsComunicacao", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LogsComunicacao_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LogsComunicacao_ProjetosVaga_ProjetoId",
                        column: x => x.ProjetoId,
                        principalTable: "ProjetosVaga",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ProjetoCandidatos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ProjetoId = table.Column<Guid>(type: "uuid", nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    FaseAtualId = table.Column<Guid>(type: "uuid", nullable: true),
                    Observacoes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjetoCandidatos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjetoCandidatos_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProjetoCandidatos_FasesProcesso_FaseAtualId",
                        column: x => x.FaseAtualId,
                        principalTable: "FasesProcesso",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ProjetoCandidatos_ProjetosVaga_ProjetoId",
                        column: x => x.ProjetoId,
                        principalTable: "ProjetosVaga",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_Aprovador1Id",
                table: "SolicitacoesVaga",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_Aprovador2Id",
                table: "SolicitacoesVaga",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_SubstituidoFuncionarioId",
                table: "SolicitacoesVaga",
                column: "SubstituidoFuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_GestorDiretoId",
                table: "Funcionarios",
                column: "GestorDiretoId");

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_NivelHierarquicoId",
                table: "Funcionarios",
                column: "NivelHierarquicoId");

            migrationBuilder.CreateIndex(
                name: "IX_CamposPersonalizadosVaga_TenantId_VagaId_Ordem",
                table: "CamposPersonalizadosVaga",
                columns: new[] { "TenantId", "VagaId", "Ordem" });

            migrationBuilder.CreateIndex(
                name: "IX_CamposPersonalizadosVaga_VagaId",
                table: "CamposPersonalizadosVaga",
                column: "VagaId");

            migrationBuilder.CreateIndex(
                name: "IX_FasesProcesso_ProjetoId",
                table: "FasesProcesso",
                column: "ProjetoId");

            migrationBuilder.CreateIndex(
                name: "IX_FasesProcesso_TenantId_ProjetoId_Ordem",
                table: "FasesProcesso",
                columns: new[] { "TenantId", "ProjetoId", "Ordem" });

            migrationBuilder.CreateIndex(
                name: "IX_LogsComunicacao_CandidatoId",
                table: "LogsComunicacao",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_LogsComunicacao_ProjetoId",
                table: "LogsComunicacao",
                column: "ProjetoId");

            migrationBuilder.CreateIndex(
                name: "IX_LogsComunicacao_TenantId_CandidatoId_DataUtc",
                table: "LogsComunicacao",
                columns: new[] { "TenantId", "CandidatoId", "DataUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_NiveisHierarquicos_TenantId_Ordem",
                table: "NiveisHierarquicos",
                columns: new[] { "TenantId", "Ordem" });

            migrationBuilder.CreateIndex(
                name: "IX_ProjetoCandidatos_CandidatoId",
                table: "ProjetoCandidatos",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjetoCandidatos_FaseAtualId",
                table: "ProjetoCandidatos",
                column: "FaseAtualId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjetoCandidatos_ProjetoId",
                table: "ProjetoCandidatos",
                column: "ProjetoId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjetoCandidatos_TenantId_ProjetoId_CandidatoId",
                table: "ProjetoCandidatos",
                columns: new[] { "TenantId", "ProjetoId", "CandidatoId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProjetosVaga_TenantId_VagaId_Numero",
                table: "ProjetosVaga",
                columns: new[] { "TenantId", "VagaId", "Numero" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProjetosVaga_VagaId",
                table: "ProjetosVaga",
                column: "VagaId");

            migrationBuilder.AddForeignKey(
                name: "FK_Funcionarios_Funcionarios_GestorDiretoId",
                table: "Funcionarios",
                column: "GestorDiretoId",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Funcionarios_NiveisHierarquicos_NivelHierarquicoId",
                table: "Funcionarios",
                column: "NivelHierarquicoId",
                principalTable: "NiveisHierarquicos",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesVaga_Funcionarios_Aprovador1Id",
                table: "SolicitacoesVaga",
                column: "Aprovador1Id",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesVaga_Funcionarios_Aprovador2Id",
                table: "SolicitacoesVaga",
                column: "Aprovador2Id",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesVaga_Funcionarios_SubstituidoFuncionarioId",
                table: "SolicitacoesVaga",
                column: "SubstituidoFuncionarioId",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Funcionarios_Funcionarios_GestorDiretoId",
                table: "Funcionarios");

            migrationBuilder.DropForeignKey(
                name: "FK_Funcionarios_NiveisHierarquicos_NivelHierarquicoId",
                table: "Funcionarios");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesVaga_Funcionarios_Aprovador1Id",
                table: "SolicitacoesVaga");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesVaga_Funcionarios_Aprovador2Id",
                table: "SolicitacoesVaga");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesVaga_Funcionarios_SubstituidoFuncionarioId",
                table: "SolicitacoesVaga");

            migrationBuilder.DropTable(
                name: "CamposPersonalizadosVaga");

            migrationBuilder.DropTable(
                name: "LogsComunicacao");

            migrationBuilder.DropTable(
                name: "NiveisHierarquicos");

            migrationBuilder.DropTable(
                name: "ProjetoCandidatos");

            migrationBuilder.DropTable(
                name: "FasesProcesso");

            migrationBuilder.DropTable(
                name: "ProjetosVaga");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesVaga_Aprovador1Id",
                table: "SolicitacoesVaga");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesVaga_Aprovador2Id",
                table: "SolicitacoesVaga");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesVaga_SubstituidoFuncionarioId",
                table: "SolicitacoesVaga");

            migrationBuilder.DropIndex(
                name: "IX_Funcionarios_GestorDiretoId",
                table: "Funcionarios");

            migrationBuilder.DropIndex(
                name: "IX_Funcionarios_NivelHierarquicoId",
                table: "Funcionarios");

            migrationBuilder.DropColumn(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador1Id",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador1Status",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador2Id",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador2Status",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "IsConfidencial",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "SubstituidoFuncionarioId",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "SubstituidoNome",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "TipoSolicitacao",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "AvatarFileName",
                table: "Funcionarios");

            migrationBuilder.DropColumn(
                name: "GestorDiretoId",
                table: "Funcionarios");

            migrationBuilder.DropColumn(
                name: "NivelHierarquicoId",
                table: "Funcionarios");

            migrationBuilder.DropColumn(
                name: "TrabalhandoAtualmente",
                table: "Candidatos");
        }
    }
}
