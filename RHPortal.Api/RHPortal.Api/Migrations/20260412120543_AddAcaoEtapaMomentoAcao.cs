using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAcaoEtapaMomentoAcao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "AcaoEtapa",
                table: "SolicitacoesAprovacaoEtapas",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<short>(
                name: "MomentoAcao",
                table: "SolicitacoesAprovacaoEtapas",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<string>(
                name: "CodRegistroExterior",
                table: "PreAdmissoes",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "DataOpcaoFgts",
                table: "PreAdmissoes",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DocMilitarCircunscricao",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "LastActivityUtc",
                table: "PreAdmissoes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NomeSocial",
                table: "PreAdmissoes",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaisNacionalidade",
                table: "PreAdmissoes",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResideExterior",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WizardCompletionPercent",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WizardCurrentStep",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "AcaoEtapa",
                table: "EtapasConfigAprovacao",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<short>(
                name: "MomentoAcao",
                table: "EtapasConfigAprovacao",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            // AprovadoresAlternativos already created by 20260411220000 with IF NOT EXISTS
            migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""AprovadoresAlternativos"" (
    ""Id"" uuid NOT NULL,
    ""TenantId"" character varying(64) NOT NULL,
    ""GestorId"" uuid NOT NULL,
    ""AprovadorId"" uuid NOT NULL,
    ""DataInicio"" date NOT NULL,
    ""DataFim"" date NULL,
    ""CreatedAtUtc"" timestamptz NOT NULL,
    ""UpdatedAtUtc"" timestamptz NOT NULL,
    CONSTRAINT ""PK_AprovadoresAlternativos"" PRIMARY KEY (""Id""),
    CONSTRAINT ""FK_AprovadoresAlternativos_Funcionarios_GestorId""
        FOREIGN KEY (""GestorId"") REFERENCES ""Funcionarios""(""Id"") ON DELETE CASCADE,
    CONSTRAINT ""FK_AprovadoresAlternativos_Funcionarios_AprovadorId""
        FOREIGN KEY (""AprovadorId"") REFERENCES ""Funcionarios""(""Id"") ON DELETE CASCADE
);
");

            migrationBuilder.CreateTable(
                name: "EtapasConfigWorkflowRH",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TipoWorkflow = table.Column<short>(type: "smallint", nullable: false),
                    Ordem = table.Column<int>(type: "integer", nullable: false),
                    Codigo = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Label = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Descricao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SlaPrazoDias = table.Column<int>(type: "integer", nullable: true),
                    Obrigatoria = table.Column<bool>(type: "boolean", nullable: false),
                    RoleFilaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EtapasConfigWorkflowRH", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EtapasConfigWorkflowRH_Roles_RoleFilaId",
                        column: x => x.RoleFilaId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "PreAdmissaoDependentes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PreAdmissaoId = table.Column<Guid>(type: "uuid", nullable: false),
                    NomeCompleto = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Parentesco = table.Column<short>(type: "smallint", nullable: false),
                    Cpf = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: true),
                    DataNascimento = table.Column<DateOnly>(type: "date", nullable: false),
                    IsPcd = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PreAdmissaoDependentes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PreAdmissaoDependentes_PreAdmissoes_PreAdmissaoId",
                        column: x => x.PreAdmissaoId,
                        principalTable: "PreAdmissoes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkflowsRH",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TipoWorkflow = table.Column<short>(type: "smallint", nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: true),
                    PreAdmissaoId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    ResponsavelId = table.Column<Guid>(type: "uuid", nullable: true),
                    DataInicio = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    DataConclusao = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    SlaPrazoDias = table.Column<int>(type: "integer", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowsRH", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkflowsRH_Funcionarios_ResponsavelId",
                        column: x => x.ResponsavelId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_WorkflowsRH_PreAdmissoes_PreAdmissaoId",
                        column: x => x.PreAdmissaoId,
                        principalTable: "PreAdmissoes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_WorkflowsRH_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "EtapasWorkflowRH",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    WorkflowId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordem = table.Column<int>(type: "integer", nullable: false),
                    Codigo = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Label = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Descricao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    Obrigatoria = table.Column<bool>(type: "boolean", nullable: false),
                    ResponsavelId = table.Column<Guid>(type: "uuid", nullable: true),
                    RoleFilaId = table.Column<Guid>(type: "uuid", nullable: true),
                    SlaPrazoDias = table.Column<int>(type: "integer", nullable: true),
                    DataInicio = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    DataConclusao = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    DadosJson = table.Column<string>(type: "text", nullable: true),
                    Observacoes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EtapasWorkflowRH", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EtapasWorkflowRH_Funcionarios_ResponsavelId",
                        column: x => x.ResponsavelId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_EtapasWorkflowRH_WorkflowsRH_WorkflowId",
                        column: x => x.WorkflowId,
                        principalTable: "WorkflowsRH",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HistoricosAlteracaoWorkflowRH",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    WorkflowId = table.Column<Guid>(type: "uuid", nullable: false),
                    EtapaWorkflowId = table.Column<Guid>(type: "uuid", nullable: true),
                    Campo = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    ValorAnterior = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ValorNovo = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    OrigemPreenchimento = table.Column<short>(type: "smallint", nullable: false),
                    AlteradoPorId = table.Column<Guid>(type: "uuid", nullable: false),
                    AlteradoPorNome = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    DataAlteracaoUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Observacao = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HistoricosAlteracaoWorkflowRH", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HistoricosAlteracaoWorkflowRH_EtapasWorkflowRH_EtapaWorkflo~",
                        column: x => x.EtapaWorkflowId,
                        principalTable: "EtapasWorkflowRH",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_HistoricosAlteracaoWorkflowRH_Funcionarios_AlteradoPorId",
                        column: x => x.AlteradoPorId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_HistoricosAlteracaoWorkflowRH_WorkflowsRH_WorkflowId",
                        column: x => x.WorkflowId,
                        principalTable: "WorkflowsRH",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql(@"
CREATE INDEX IF NOT EXISTS ""IX_AprovadoresAlternativos_AprovadorId"" ON ""AprovadoresAlternativos"" (""AprovadorId"");
CREATE INDEX IF NOT EXISTS ""IX_AprovadoresAlternativos_GestorId"" ON ""AprovadoresAlternativos"" (""GestorId"");
CREATE INDEX IF NOT EXISTS ""IX_AprovadoresAlternativos_TenantId_GestorId"" ON ""AprovadoresAlternativos"" (""TenantId"", ""GestorId"");
");

            migrationBuilder.CreateIndex(
                name: "IX_EtapasConfigWorkflowRH_RoleFilaId",
                table: "EtapasConfigWorkflowRH",
                column: "RoleFilaId");

            migrationBuilder.CreateIndex(
                name: "IX_EtapasConfigWorkflowRH_TenantId_TipoWorkflow_Ordem",
                table: "EtapasConfigWorkflowRH",
                columns: new[] { "TenantId", "TipoWorkflow", "Ordem" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EtapasWorkflowRH_ResponsavelId",
                table: "EtapasWorkflowRH",
                column: "ResponsavelId");

            migrationBuilder.CreateIndex(
                name: "IX_EtapasWorkflowRH_WorkflowId_Ordem",
                table: "EtapasWorkflowRH",
                columns: new[] { "WorkflowId", "Ordem" });

            migrationBuilder.CreateIndex(
                name: "IX_HistoricosAlteracaoWorkflowRH_AlteradoPorId",
                table: "HistoricosAlteracaoWorkflowRH",
                column: "AlteradoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_HistoricosAlteracaoWorkflowRH_EtapaWorkflowId",
                table: "HistoricosAlteracaoWorkflowRH",
                column: "EtapaWorkflowId");

            migrationBuilder.CreateIndex(
                name: "IX_HistoricosAlteracaoWorkflowRH_WorkflowId_DataAlteracaoUtc",
                table: "HistoricosAlteracaoWorkflowRH",
                columns: new[] { "WorkflowId", "DataAlteracaoUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissaoDependentes_PreAdmissaoId",
                table: "PreAdmissaoDependentes",
                column: "PreAdmissaoId");

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissaoDependentes_TenantId_PreAdmissaoId",
                table: "PreAdmissaoDependentes",
                columns: new[] { "TenantId", "PreAdmissaoId" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowsRH_PreAdmissaoId",
                table: "WorkflowsRH",
                column: "PreAdmissaoId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowsRH_ResponsavelId",
                table: "WorkflowsRH",
                column: "ResponsavelId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowsRH_TenantId_PreAdmissaoId",
                table: "WorkflowsRH",
                columns: new[] { "TenantId", "PreAdmissaoId" },
                filter: "\"PreAdmissaoId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowsRH_TenantId_TipoWorkflow_Status",
                table: "WorkflowsRH",
                columns: new[] { "TenantId", "TipoWorkflow", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowsRH_TenantId_VagaId",
                table: "WorkflowsRH",
                columns: new[] { "TenantId", "VagaId" },
                filter: "\"VagaId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowsRH_VagaId",
                table: "WorkflowsRH",
                column: "VagaId");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EtapasConfigWorkflowRH");

            migrationBuilder.DropTable(
                name: "HistoricosAlteracaoWorkflowRH");

            migrationBuilder.DropTable(
                name: "PreAdmissaoDependentes");

            migrationBuilder.DropTable(
                name: "EtapasWorkflowRH");

            migrationBuilder.DropTable(
                name: "WorkflowsRH");

            migrationBuilder.DropColumn(
                name: "AcaoEtapa",
                table: "SolicitacoesAprovacaoEtapas");

            migrationBuilder.DropColumn(
                name: "MomentoAcao",
                table: "SolicitacoesAprovacaoEtapas");

            migrationBuilder.DropColumn(
                name: "CodRegistroExterior",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "DataOpcaoFgts",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "DocMilitarCircunscricao",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "LastActivityUtc",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "NomeSocial",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "PaisNacionalidade",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "ResideExterior",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "WizardCompletionPercent",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "WizardCurrentStep",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "AcaoEtapa",
                table: "EtapasConfigAprovacao");

            migrationBuilder.DropColumn(
                name: "MomentoAcao",
                table: "EtapasConfigAprovacao");
        }
    }
}
