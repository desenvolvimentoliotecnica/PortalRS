using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSolicitacoesRH : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Justificativa",
                table: "CandidatoVagaMatchingScores",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RuleVersion",
                table: "CandidatoVagaMatchingScores",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScoreCompetencia",
                table: "CandidatoVagaMatchingScores",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScoreExperiencia",
                table: "CandidatoVagaMatchingScores",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScoreFormacao",
                table: "CandidatoVagaMatchingScores",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScoreLocalidade",
                table: "CandidatoVagaMatchingScores",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "CandidatoVagaMatchingScores",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BatchMatchingRuns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    StartedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CompletedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    TotalVagas = table.Column<int>(type: "integer", nullable: false),
                    ProcessedVagas = table.Column<int>(type: "integer", nullable: false),
                    FailedVagas = table.Column<int>(type: "integer", nullable: false),
                    TotalCandidatesScored = table.Column<int>(type: "integer", nullable: false),
                    LastProcessedVagaId = table.Column<Guid>(type: "uuid", nullable: true),
                    LastError = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BatchMatchingRuns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RecruiterMatchingFeedbacks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecruiterUserId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Action = table.Column<short>(type: "smallint", nullable: false),
                    MatchScoreAtAction = table.Column<int>(type: "integer", nullable: true),
                    RankPositionAtAction = table.Column<int>(type: "integer", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecruiterMatchingFeedbacks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Skills",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CanonicalName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    ParentSkillId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Skills", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Skills_Skills_ParentSkillId",
                        column: x => x.ParentSkillId,
                        principalTable: "Skills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "SolicitacoesBeneficio",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    SolicitanteId = table.Column<Guid>(type: "uuid", nullable: false),
                    TipoBeneficio = table.Column<short>(type: "smallint", nullable: false),
                    TipoAlteracao = table.Column<short>(type: "smallint", nullable: false),
                    Descricao = table.Column<string>(type: "text", nullable: false),
                    IncluirDependentes = table.Column<bool>(type: "boolean", nullable: false),
                    DependenteIdsJson = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    Aprovador1Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador1Status = table.Column<short>(type: "smallint", nullable: false),
                    Aprovador1DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador2Status = table.Column<short>(type: "smallint", nullable: true),
                    Aprovador2DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Habilitado = table.Column<bool>(type: "boolean", nullable: false),
                    ObservacaoAprovador = table.Column<string>(type: "text", nullable: true),
                    Observacoes = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitacoesBeneficio", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SolicitacoesBeneficio_Funcionarios_Aprovador1Id",
                        column: x => x.Aprovador1Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesBeneficio_Funcionarios_Aprovador2Id",
                        column: x => x.Aprovador2Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesBeneficio_Funcionarios_SolicitanteId",
                        column: x => x.SolicitanteId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SolicitacoesDependente",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    SolicitanteId = table.Column<Guid>(type: "uuid", nullable: false),
                    TipoSolicitacao = table.Column<short>(type: "smallint", nullable: false),
                    DependenteId = table.Column<Guid>(type: "uuid", nullable: true),
                    NomeCompleto = table.Column<string>(type: "text", nullable: false),
                    Parentesco = table.Column<short>(type: "smallint", nullable: false),
                    Cpf = table.Column<string>(type: "text", nullable: true),
                    DataNascimento = table.Column<DateOnly>(type: "date", nullable: false),
                    IsPcd = table.Column<bool>(type: "boolean", nullable: false),
                    DependenteIR = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    Aprovador1Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador1Status = table.Column<short>(type: "smallint", nullable: false),
                    Aprovador1DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador2Status = table.Column<short>(type: "smallint", nullable: true),
                    Aprovador2DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Habilitado = table.Column<bool>(type: "boolean", nullable: false),
                    ObservacaoAprovador = table.Column<string>(type: "text", nullable: true),
                    Observacoes = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitacoesDependente", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SolicitacoesDependente_Dependentes_DependenteId",
                        column: x => x.DependenteId,
                        principalTable: "Dependentes",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesDependente_Funcionarios_Aprovador1Id",
                        column: x => x.Aprovador1Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesDependente_Funcionarios_Aprovador2Id",
                        column: x => x.Aprovador2Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesDependente_Funcionarios_SolicitanteId",
                        column: x => x.SolicitanteId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SolicitacoesDesligamento",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    SolicitanteId = table.Column<Guid>(type: "uuid", nullable: false),
                    FuncionarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    DataDesligamento = table.Column<DateOnly>(type: "date", nullable: false),
                    TipoDesligamento = table.Column<short>(type: "smallint", nullable: false),
                    MotivoDesligamento = table.Column<string>(type: "text", nullable: false),
                    TipoAvisoPrevio = table.Column<short>(type: "smallint", nullable: false),
                    DiasAvisoPrevio = table.Column<int>(type: "integer", nullable: false),
                    ElegivelRecontratacao = table.Column<bool>(type: "boolean", nullable: false),
                    SubstituirPosicao = table.Column<bool>(type: "boolean", nullable: false),
                    SolicitacaoVagaGeradaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    Aprovador1Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador1Status = table.Column<short>(type: "smallint", nullable: false),
                    Aprovador1DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador2Status = table.Column<short>(type: "smallint", nullable: true),
                    Aprovador2DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Habilitado = table.Column<bool>(type: "boolean", nullable: false),
                    ObservacaoAprovador = table.Column<string>(type: "text", nullable: true),
                    Observacoes = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitacoesDesligamento", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SolicitacoesDesligamento_Funcionarios_Aprovador1Id",
                        column: x => x.Aprovador1Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesDesligamento_Funcionarios_Aprovador2Id",
                        column: x => x.Aprovador2Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesDesligamento_Funcionarios_FuncionarioId",
                        column: x => x.FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SolicitacoesDesligamento_Funcionarios_SolicitanteId",
                        column: x => x.SolicitanteId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SolicitacoesEndereco",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    SolicitanteId = table.Column<Guid>(type: "uuid", nullable: false),
                    Cep = table.Column<string>(type: "text", nullable: false),
                    Logradouro = table.Column<string>(type: "text", nullable: false),
                    Numero = table.Column<string>(type: "text", nullable: true),
                    Bairro = table.Column<string>(type: "text", nullable: true),
                    Complemento = table.Column<string>(type: "text", nullable: true),
                    Cidade = table.Column<string>(type: "text", nullable: false),
                    Uf = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    Aprovador1Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador1Status = table.Column<short>(type: "smallint", nullable: false),
                    Aprovador1DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador2Status = table.Column<short>(type: "smallint", nullable: true),
                    Aprovador2DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Habilitado = table.Column<bool>(type: "boolean", nullable: false),
                    ObservacaoAprovador = table.Column<string>(type: "text", nullable: true),
                    Observacoes = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitacoesEndereco", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SolicitacoesEndereco_Funcionarios_Aprovador1Id",
                        column: x => x.Aprovador1Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesEndereco_Funcionarios_Aprovador2Id",
                        column: x => x.Aprovador2Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesEndereco_Funcionarios_SolicitanteId",
                        column: x => x.SolicitanteId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SolicitacoesFerias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    SolicitanteId = table.Column<Guid>(type: "uuid", nullable: false),
                    PeriodoAquisitivo = table.Column<string>(type: "text", nullable: true),
                    DataInicio = table.Column<DateOnly>(type: "date", nullable: false),
                    DataFim = table.Column<DateOnly>(type: "date", nullable: false),
                    QtdDias = table.Column<int>(type: "integer", nullable: false),
                    AbonoPecuniario = table.Column<bool>(type: "boolean", nullable: false),
                    DiasAbono = table.Column<int>(type: "integer", nullable: false),
                    Adiantamento13 = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    Aprovador1Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador1Status = table.Column<short>(type: "smallint", nullable: false),
                    Aprovador1DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador2Status = table.Column<short>(type: "smallint", nullable: true),
                    Aprovador2DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Habilitado = table.Column<bool>(type: "boolean", nullable: false),
                    ObservacaoAprovador = table.Column<string>(type: "text", nullable: true),
                    Observacoes = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitacoesFerias", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SolicitacoesFerias_Funcionarios_Aprovador1Id",
                        column: x => x.Aprovador1Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesFerias_Funcionarios_Aprovador2Id",
                        column: x => x.Aprovador2Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesFerias_Funcionarios_SolicitanteId",
                        column: x => x.SolicitanteId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SolicitacoesPromocao",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    SolicitanteId = table.Column<Guid>(type: "uuid", nullable: false),
                    FuncionarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    DataEfetiva = table.Column<DateOnly>(type: "date", nullable: false),
                    CargoAtualId = table.Column<Guid>(type: "uuid", nullable: true),
                    NovoCargoId = table.Column<Guid>(type: "uuid", nullable: false),
                    AreaAtualId = table.Column<Guid>(type: "uuid", nullable: true),
                    NovaAreaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Justificativa = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    Aprovador1Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador1Status = table.Column<short>(type: "smallint", nullable: false),
                    Aprovador1DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador2Status = table.Column<short>(type: "smallint", nullable: true),
                    Aprovador2DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Habilitado = table.Column<bool>(type: "boolean", nullable: false),
                    ObservacaoAprovador = table.Column<string>(type: "text", nullable: true),
                    Observacoes = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitacoesPromocao", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SolicitacoesPromocao_Areas_AreaAtualId",
                        column: x => x.AreaAtualId,
                        principalTable: "Areas",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesPromocao_Areas_NovaAreaId",
                        column: x => x.NovaAreaId,
                        principalTable: "Areas",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesPromocao_Funcionarios_Aprovador1Id",
                        column: x => x.Aprovador1Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesPromocao_Funcionarios_Aprovador2Id",
                        column: x => x.Aprovador2Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesPromocao_Funcionarios_FuncionarioId",
                        column: x => x.FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SolicitacoesPromocao_Funcionarios_SolicitanteId",
                        column: x => x.SolicitanteId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SolicitacoesPromocao_JobPositions_CargoAtualId",
                        column: x => x.CargoAtualId,
                        principalTable: "JobPositions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesPromocao_JobPositions_NovoCargoId",
                        column: x => x.NovoCargoId,
                        principalTable: "JobPositions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BatchMatchingRunVagas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RunId = table.Column<Guid>(type: "uuid", nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    ScoresGenerated = table.Column<int>(type: "integer", nullable: false),
                    StartedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CompletedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ErrorMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BatchMatchingRunVagas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BatchMatchingRunVagas_BatchMatchingRuns_RunId",
                        column: x => x.RunId,
                        principalTable: "BatchMatchingRuns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SkillAliases",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SkillId = table.Column<Guid>(type: "uuid", nullable: false),
                    AliasName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SkillAliases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SkillAliases_Skills_SkillId",
                        column: x => x.SkillId,
                        principalTable: "Skills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BatchMatchingRuns_TenantId_CreatedAtUtc",
                table: "BatchMatchingRuns",
                columns: new[] { "TenantId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_BatchMatchingRunVagas_RunId",
                table: "BatchMatchingRunVagas",
                column: "RunId");

            migrationBuilder.CreateIndex(
                name: "IX_RecruiterMatchingFeedbacks_TenantId_VagaId",
                table: "RecruiterMatchingFeedbacks",
                columns: new[] { "TenantId", "VagaId" });

            migrationBuilder.CreateIndex(
                name: "IX_RecruiterMatchingFeedbacks_VagaId_CandidatoId",
                table: "RecruiterMatchingFeedbacks",
                columns: new[] { "VagaId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_SkillAliases_SkillId",
                table: "SkillAliases",
                column: "SkillId");

            migrationBuilder.CreateIndex(
                name: "IX_SkillAliases_TenantId_AliasName",
                table: "SkillAliases",
                columns: new[] { "TenantId", "AliasName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Skills_ParentSkillId",
                table: "Skills",
                column: "ParentSkillId");

            migrationBuilder.CreateIndex(
                name: "IX_Skills_TenantId_CanonicalName",
                table: "Skills",
                columns: new[] { "TenantId", "CanonicalName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesBeneficio_Aprovador1Id",
                table: "SolicitacoesBeneficio",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesBeneficio_Aprovador2Id",
                table: "SolicitacoesBeneficio",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesBeneficio_SolicitanteId",
                table: "SolicitacoesBeneficio",
                column: "SolicitanteId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesDependente_Aprovador1Id",
                table: "SolicitacoesDependente",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesDependente_Aprovador2Id",
                table: "SolicitacoesDependente",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesDependente_DependenteId",
                table: "SolicitacoesDependente",
                column: "DependenteId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesDependente_SolicitanteId",
                table: "SolicitacoesDependente",
                column: "SolicitanteId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesDesligamento_Aprovador1Id",
                table: "SolicitacoesDesligamento",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesDesligamento_Aprovador2Id",
                table: "SolicitacoesDesligamento",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesDesligamento_FuncionarioId",
                table: "SolicitacoesDesligamento",
                column: "FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesDesligamento_SolicitanteId",
                table: "SolicitacoesDesligamento",
                column: "SolicitanteId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesEndereco_Aprovador1Id",
                table: "SolicitacoesEndereco",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesEndereco_Aprovador2Id",
                table: "SolicitacoesEndereco",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesEndereco_SolicitanteId",
                table: "SolicitacoesEndereco",
                column: "SolicitanteId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesFerias_Aprovador1Id",
                table: "SolicitacoesFerias",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesFerias_Aprovador2Id",
                table: "SolicitacoesFerias",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesFerias_SolicitanteId",
                table: "SolicitacoesFerias",
                column: "SolicitanteId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_Aprovador1Id",
                table: "SolicitacoesPromocao",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_Aprovador2Id",
                table: "SolicitacoesPromocao",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_AreaAtualId",
                table: "SolicitacoesPromocao",
                column: "AreaAtualId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_CargoAtualId",
                table: "SolicitacoesPromocao",
                column: "CargoAtualId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_FuncionarioId",
                table: "SolicitacoesPromocao",
                column: "FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_NovaAreaId",
                table: "SolicitacoesPromocao",
                column: "NovaAreaId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_NovoCargoId",
                table: "SolicitacoesPromocao",
                column: "NovoCargoId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_SolicitanteId",
                table: "SolicitacoesPromocao",
                column: "SolicitanteId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BatchMatchingRunVagas");

            migrationBuilder.DropTable(
                name: "RecruiterMatchingFeedbacks");

            migrationBuilder.DropTable(
                name: "SkillAliases");

            migrationBuilder.DropTable(
                name: "SolicitacoesBeneficio");

            migrationBuilder.DropTable(
                name: "SolicitacoesDependente");

            migrationBuilder.DropTable(
                name: "SolicitacoesDesligamento");

            migrationBuilder.DropTable(
                name: "SolicitacoesEndereco");

            migrationBuilder.DropTable(
                name: "SolicitacoesFerias");

            migrationBuilder.DropTable(
                name: "SolicitacoesPromocao");

            migrationBuilder.DropTable(
                name: "BatchMatchingRuns");

            migrationBuilder.DropTable(
                name: "Skills");

            migrationBuilder.DropColumn(
                name: "Justificativa",
                table: "CandidatoVagaMatchingScores");

            migrationBuilder.DropColumn(
                name: "RuleVersion",
                table: "CandidatoVagaMatchingScores");

            migrationBuilder.DropColumn(
                name: "ScoreCompetencia",
                table: "CandidatoVagaMatchingScores");

            migrationBuilder.DropColumn(
                name: "ScoreExperiencia",
                table: "CandidatoVagaMatchingScores");

            migrationBuilder.DropColumn(
                name: "ScoreFormacao",
                table: "CandidatoVagaMatchingScores");

            migrationBuilder.DropColumn(
                name: "ScoreLocalidade",
                table: "CandidatoVagaMatchingScores");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "CandidatoVagaMatchingScores");
        }
    }
}
