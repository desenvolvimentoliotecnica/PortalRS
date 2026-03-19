using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSolicitacaoVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Dependentes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FuncionarioId = table.Column<Guid>(type: "uuid", nullable: false),
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
                    table.PrimaryKey("PK_Dependentes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Dependentes_Funcionarios_FuncionarioId",
                        column: x => x.FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DocumentosColaborador",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FuncionarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<short>(type: "smallint", nullable: false),
                    NomeArquivo = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TamanhoBytes = table.Column<long>(type: "bigint", nullable: false),
                    StoragePath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    ObservacaoRh = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentosColaborador", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DocumentosColaborador_Funcionarios_FuncionarioId",
                        column: x => x.FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FaixasSalariais",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    EstabelecimentoCodigo = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    JobPositionId = table.Column<Guid>(type: "uuid", nullable: true),
                    SalarioMinimo = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    SalarioMaximo = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Descricao = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FaixasSalariais", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FaixasSalariais_JobPositions_JobPositionId",
                        column: x => x.JobPositionId,
                        principalTable: "JobPositions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "PreAdmissoes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    PreenchidoPor = table.Column<short>(type: "smallint", nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: true),
                    RevisadoPorId = table.Column<Guid>(type: "uuid", nullable: true),
                    AprovadoPorId = table.Column<Guid>(type: "uuid", nullable: true),
                    ObservacaoRh = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    MotivoRejeicao = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Cpf = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: true),
                    Rg = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    RgOrgaoExpedidor = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    RgDataExpedicao = table.Column<DateOnly>(type: "date", nullable: true),
                    DataNascimento = table.Column<DateOnly>(type: "date", nullable: true),
                    Sexo = table.Column<short>(type: "smallint", nullable: false),
                    EstadoCivil = table.Column<short>(type: "smallint", nullable: false),
                    Nacionalidade = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    NomeMae = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    NomePai = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    NaturalCidade = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    NaturalUf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    Passaporte = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    RnmRne = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    ValidadeVisto = table.Column<DateOnly>(type: "date", nullable: true),
                    TipoVisto = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Cep = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Logradouro = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Numero = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Complemento = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Bairro = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Cidade = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Uf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    Email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    Telefone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Celular = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ContatoEmergenciaNome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    ContatoEmergenciaFone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    BancoCodigo = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    BancoNome = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Agencia = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    AgenciaDigito = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    Conta = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ContaDigito = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    TipoConta = table.Column<short>(type: "smallint", nullable: true),
                    EstabelecimentoCodigo = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    MatriculaRM = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: true),
                    JobPositionId = table.Column<Guid>(type: "uuid", nullable: true),
                    RequisitoCategoriaId = table.Column<Guid>(type: "uuid", nullable: true),
                    DataAdmissao = table.Column<DateOnly>(type: "date", nullable: true),
                    Salario = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    TipoContratacao = table.Column<short>(type: "smallint", nullable: true),
                    CargaHorariaSemanal = table.Column<short>(type: "smallint", nullable: true),
                    PisPasep = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    TituloEleitorNumero = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    TituloEleitorZona = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    TituloEleitorSecao = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    ReservistaNumero = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CategoriaCnh = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    ValidadeCnh = table.Column<DateOnly>(type: "date", nullable: true),
                    Ctps = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CtpsSerie = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    CtpsUf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    ValidacaoCpfOk = table.Column<bool>(type: "boolean", nullable: false),
                    ValidacaoCepOk = table.Column<bool>(type: "boolean", nullable: false),
                    ValidacaoBancoOk = table.Column<bool>(type: "boolean", nullable: false),
                    ValidacaoSalarioOk = table.Column<bool>(type: "boolean", nullable: false),
                    ValidacaoSalarioJustificativa = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SubmittedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PreAdmissoes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PreAdmissoes_Areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "Areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PreAdmissoes_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PreAdmissoes_Funcionarios_AprovadoPorId",
                        column: x => x.AprovadoPorId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PreAdmissoes_Funcionarios_RevisadoPorId",
                        column: x => x.RevisadoPorId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PreAdmissoes_JobPositions_JobPositionId",
                        column: x => x.JobPositionId,
                        principalTable: "JobPositions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PreAdmissoes_RequisitoCategorias_RequisitoCategoriaId",
                        column: x => x.RequisitoCategoriaId,
                        principalTable: "RequisitoCategorias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PreAdmissoes_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "SolicitacoesVaga",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SolicitanteId = table.Column<Guid>(type: "uuid", nullable: false),
                    AprovadorId = table.Column<Guid>(type: "uuid", nullable: true),
                    JobPositionId = table.Column<Guid>(type: "uuid", nullable: true),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: true),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    Titulo = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Justificativa = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    QtdPosicoes = table.Column<int>(type: "integer", nullable: false),
                    Urgencia = table.Column<short>(type: "smallint", nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: true),
                    ObservacaoAprovador = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitacoesVaga", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SolicitacoesVaga_Areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "Areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SolicitacoesVaga_Funcionarios_AprovadorId",
                        column: x => x.AprovadorId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SolicitacoesVaga_Funcionarios_SolicitanteId",
                        column: x => x.SolicitanteId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SolicitacoesVaga_JobPositions_JobPositionId",
                        column: x => x.JobPositionId,
                        principalTable: "JobPositions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SolicitacoesVaga_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PreAdmissaoDocumentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PreAdmissaoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<short>(type: "smallint", nullable: false),
                    NomeArquivo = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TamanhoBytes = table.Column<long>(type: "bigint", nullable: false),
                    StoragePath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    ObservacaoRh = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PreAdmissaoDocumentos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PreAdmissaoDocumentos_PreAdmissoes_PreAdmissaoId",
                        column: x => x.PreAdmissaoId,
                        principalTable: "PreAdmissoes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_TenantId_SurveyId_UserId",
                table: "SurveyResponses",
                columns: new[] { "TenantId", "SurveyId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Dependentes_FuncionarioId",
                table: "Dependentes",
                column: "FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Dependentes_TenantId_FuncionarioId",
                table: "Dependentes",
                columns: new[] { "TenantId", "FuncionarioId" });

            migrationBuilder.CreateIndex(
                name: "IX_DocumentosColaborador_FuncionarioId",
                table: "DocumentosColaborador",
                column: "FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentosColaborador_TenantId_FuncionarioId",
                table: "DocumentosColaborador",
                columns: new[] { "TenantId", "FuncionarioId" });

            migrationBuilder.CreateIndex(
                name: "IX_FaixasSalariais_JobPositionId",
                table: "FaixasSalariais",
                column: "JobPositionId");

            migrationBuilder.CreateIndex(
                name: "IX_FaixasSalariais_TenantId_JobPositionId_EstabelecimentoCodigo",
                table: "FaixasSalariais",
                columns: new[] { "TenantId", "JobPositionId", "EstabelecimentoCodigo" });

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissaoDocumentos_PreAdmissaoId",
                table: "PreAdmissaoDocumentos",
                column: "PreAdmissaoId");

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissaoDocumentos_TenantId_PreAdmissaoId",
                table: "PreAdmissaoDocumentos",
                columns: new[] { "TenantId", "PreAdmissaoId" });

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissoes_AprovadoPorId",
                table: "PreAdmissoes",
                column: "AprovadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissoes_AreaId",
                table: "PreAdmissoes",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissoes_CandidatoId",
                table: "PreAdmissoes",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissoes_JobPositionId",
                table: "PreAdmissoes",
                column: "JobPositionId");

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissoes_RequisitoCategoriaId",
                table: "PreAdmissoes",
                column: "RequisitoCategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissoes_RevisadoPorId",
                table: "PreAdmissoes",
                column: "RevisadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissoes_TenantId_Cpf",
                table: "PreAdmissoes",
                columns: new[] { "TenantId", "Cpf" });

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissoes_TenantId_Status",
                table: "PreAdmissoes",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissoes_UnitId",
                table: "PreAdmissoes",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_AprovadorId",
                table: "SolicitacoesVaga",
                column: "AprovadorId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_AreaId",
                table: "SolicitacoesVaga",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_JobPositionId",
                table: "SolicitacoesVaga",
                column: "JobPositionId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_SolicitanteId",
                table: "SolicitacoesVaga",
                column: "SolicitanteId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_TenantId_SolicitanteId",
                table: "SolicitacoesVaga",
                columns: new[] { "TenantId", "SolicitanteId" });

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_TenantId_Status",
                table: "SolicitacoesVaga",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_UnitId",
                table: "SolicitacoesVaga",
                column: "UnitId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Dependentes");

            migrationBuilder.DropTable(
                name: "DocumentosColaborador");

            migrationBuilder.DropTable(
                name: "FaixasSalariais");

            migrationBuilder.DropTable(
                name: "PreAdmissaoDocumentos");

            migrationBuilder.DropTable(
                name: "SolicitacoesVaga");

            migrationBuilder.DropTable(
                name: "PreAdmissoes");

            migrationBuilder.DropIndex(
                name: "IX_SurveyResponses_TenantId_SurveyId_UserId",
                table: "SurveyResponses");
        }
    }
}
