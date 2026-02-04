using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgres : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Areas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Areas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Menus",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Route = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    Icon = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    ParentId = table.Column<Guid>(type: "uuid", nullable: true),
                    PermissionKey = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Menus", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Description = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Tenants",
                columns: table => new
                {
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tenants", x => x.TenantId);
                });

            migrationBuilder.CreateTable(
                name: "Units",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    City = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Uf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    AddressLine = table.Column<string>(type: "character varying(220)", maxLength: 220, nullable: true),
                    Neighborhood = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ZipCode = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: true),
                    Email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    Phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    ResponsibleName = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: true),
                    Type = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Headcount = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Units", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedUserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    EmailConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: true),
                    SecurityStamp = table.Column<string>(type: "text", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true),
                    PhoneNumber = table.Column<string>(type: "text", nullable: true),
                    PhoneNumberConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    TwoFactorEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    LockoutEnd = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LockoutEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    AccessFailedCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Departments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Headcount = table.Column<int>(type: "integer", nullable: false),
                    ManagerName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ManagerEmail = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    Phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    CostCenter = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    BranchOrLocation = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Departments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Departments_Areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "Areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "JobPositions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Seniority = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JobPositions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_JobPositions_Areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "Areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AspNetRoleClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoleClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetRoleClaims_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RoleMenus",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    MenuId = table.Column<Guid>(type: "uuid", nullable: false),
                    PermissionKey = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleMenus", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoleMenus_Menus_MenuId",
                        column: x => x.MenuId,
                        principalTable: "Menus",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RoleMenus_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetUserClaims_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserLogins",
                columns: table => new
                {
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    ProviderKey = table.Column<string>(type: "text", nullable: false),
                    ProviderDisplayName = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserLogins", x => new { x.LoginProvider, x.ProviderKey });
                    table.ForeignKey(
                        name: "FK_AspNetUserLogins_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserTokens",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Value = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserTokens", x => new { x.UserId, x.LoginProvider, x.Name });
                    table.ForeignKey(
                        name: "FK_AspNetUserTokens_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserRoles",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserRoles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_UserRoles_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserRoles_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Vagas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Codigo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Titulo = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    DepartmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    AreaTime = table.Column<short>(type: "smallint", nullable: true),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Modalidade = table.Column<short>(type: "smallint", nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    Senioridade = table.Column<short>(type: "smallint", nullable: true),
                    QuantidadeVagas = table.Column<int>(type: "integer", nullable: false),
                    TipoContratacao = table.Column<short>(type: "smallint", nullable: true),
                    MatchMinimoPercentual = table.Column<int>(type: "integer", nullable: false),
                    DescricaoInterna = table.Column<string>(type: "text", nullable: true),
                    CodigoInterno = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    CodigoCbo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    MotivoAbertura = table.Column<short>(type: "smallint", nullable: true),
                    OrcamentoAprovado = table.Column<short>(type: "smallint", nullable: true),
                    GestorRequisitante = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    RecrutadorResponsavel = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Prioridade = table.Column<short>(type: "smallint", nullable: true),
                    ResumoPitch = table.Column<string>(type: "text", nullable: true),
                    TagsResponsabilidadesRaw = table.Column<string>(type: "text", nullable: true),
                    TagsKeywordsRaw = table.Column<string>(type: "text", nullable: true),
                    Confidencial = table.Column<bool>(type: "boolean", nullable: false),
                    AceitaPcd = table.Column<bool>(type: "boolean", nullable: false),
                    Urgente = table.Column<bool>(type: "boolean", nullable: false),
                    GeneroPreferencia = table.Column<short>(type: "smallint", nullable: true),
                    VagaAfirmativa = table.Column<bool>(type: "boolean", nullable: false),
                    LinguagemInclusiva = table.Column<bool>(type: "boolean", nullable: false),
                    PublicoAfirmativo = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ObservacoesPcd = table.Column<string>(type: "text", nullable: true),
                    ProjetoNome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    ProjetoClienteAreaImpactada = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    ProjetoPrazoPrevisto = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    ProjetoDescricao = table.Column<string>(type: "text", nullable: true),
                    Regime = table.Column<short>(type: "smallint", nullable: true),
                    CargaSemanalHoras = table.Column<int>(type: "integer", nullable: true),
                    Escala = table.Column<short>(type: "smallint", nullable: true),
                    HoraEntrada = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    HoraSaida = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    Intervalo = table.Column<TimeSpan>(type: "interval", nullable: true),
                    Cep = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: true),
                    Logradouro = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Numero = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Bairro = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Cidade = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Uf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    PoliticaTrabalho = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ObservacoesDeslocamento = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Moeda = table.Column<short>(type: "smallint", nullable: true),
                    SalarioMinimo = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    SalarioMaximo = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Periodicidade = table.Column<short>(type: "smallint", nullable: true),
                    BonusTipo = table.Column<short>(type: "smallint", nullable: true),
                    BonusPercentual = table.Column<decimal>(type: "numeric", nullable: true),
                    ObservacoesRemuneracao = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    Escolaridade = table.Column<short>(type: "smallint", nullable: true),
                    FormacaoArea = table.Column<short>(type: "smallint", nullable: true),
                    ExperienciaMinimaAnos = table.Column<int>(type: "integer", nullable: true),
                    TagsStackRaw = table.Column<string>(type: "text", nullable: true),
                    TagsIdiomasRaw = table.Column<string>(type: "text", nullable: true),
                    Diferenciais = table.Column<string>(type: "text", nullable: true),
                    ObservacoesProcesso = table.Column<string>(type: "text", nullable: true),
                    Visibilidade = table.Column<short>(type: "smallint", nullable: true),
                    DataInicio = table.Column<DateOnly>(type: "date", nullable: true),
                    DataEncerramento = table.Column<DateOnly>(type: "date", nullable: true),
                    CanalLinkedIn = table.Column<bool>(type: "boolean", nullable: false),
                    CanalSiteCarreiras = table.Column<bool>(type: "boolean", nullable: false),
                    CanalIndicacao = table.Column<bool>(type: "boolean", nullable: false),
                    CanalPortaisEmprego = table.Column<bool>(type: "boolean", nullable: false),
                    DescricaoPublica = table.Column<string>(type: "text", nullable: true),
                    LgpdSolicitarConsentimentoExplicito = table.Column<bool>(type: "boolean", nullable: false),
                    LgpdCompartilharCurriculoInternamente = table.Column<bool>(type: "boolean", nullable: false),
                    LgpdRetencaoAtiva = table.Column<bool>(type: "boolean", nullable: false),
                    LgpdRetencaoMeses = table.Column<int>(type: "integer", nullable: true),
                    ExigeCnh = table.Column<bool>(type: "boolean", nullable: false),
                    DisponibilidadeParaViagens = table.Column<bool>(type: "boolean", nullable: false),
                    ChecagemAntecedentes = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Vagas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Vagas_Areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "Areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Vagas_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Managers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Headcount = table.Column<int>(type: "integer", nullable: false),
                    JobPositionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
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

            migrationBuilder.CreateTable(
                name: "Candidatos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Fone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Cidade = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Uf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    Fonte = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Obs = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CvText = table.Column<string>(type: "text", nullable: true),
                    LastMatchScore = table.Column<int>(type: "integer", nullable: true),
                    LastMatchPass = table.Column<bool>(type: "boolean", nullable: true),
                    LastMatchAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastMatchVagaId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Candidatos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Candidatos_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "VagaBeneficios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordem = table.Column<int>(type: "integer", nullable: false),
                    Tipo = table.Column<short>(type: "smallint", nullable: false),
                    Valor = table.Column<decimal>(type: "numeric", nullable: true),
                    Recorrencia = table.Column<short>(type: "smallint", nullable: false),
                    Obrigatorio = table.Column<bool>(type: "boolean", nullable: false),
                    Observacoes = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VagaBeneficios", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VagaBeneficios_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VagaEtapas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordem = table.Column<int>(type: "integer", nullable: false),
                    Nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Responsavel = table.Column<short>(type: "smallint", nullable: false),
                    Modo = table.Column<short>(type: "smallint", nullable: false),
                    SlaDias = table.Column<int>(type: "integer", nullable: true),
                    DescricaoInstrucoes = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VagaEtapas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VagaEtapas_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VagaPerguntas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordem = table.Column<int>(type: "integer", nullable: false),
                    Texto = table.Column<string>(type: "character varying(220)", maxLength: 220, nullable: false),
                    Tipo = table.Column<short>(type: "smallint", nullable: false),
                    Peso = table.Column<short>(type: "smallint", nullable: false),
                    Obrigatoria = table.Column<bool>(type: "boolean", nullable: false),
                    Knockout = table.Column<bool>(type: "boolean", nullable: false),
                    OpcoesRaw = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VagaPerguntas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VagaPerguntas_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VagaRequisitos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordem = table.Column<int>(type: "integer", nullable: false),
                    Nome = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Peso = table.Column<short>(type: "smallint", nullable: false),
                    Obrigatorio = table.Column<bool>(type: "boolean", nullable: false),
                    AnosMinimos = table.Column<int>(type: "integer", nullable: true),
                    Nivel = table.Column<short>(type: "smallint", nullable: true),
                    Avaliacao = table.Column<short>(type: "smallint", nullable: true),
                    SinonimosRaw = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Observacoes = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VagaRequisitos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VagaRequisitos_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoDocumentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<int>(type: "integer", nullable: false),
                    NomeArquivo = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Descricao = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    StorageFileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    TamanhoBytes = table.Column<long>(type: "bigint", nullable: true),
                    Url = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoDocumentos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidatoDocumentos_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Areas_TenantId_Code",
                table: "Areas",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetRoleClaims_RoleId",
                table: "AspNetRoleClaims",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserClaims_UserId",
                table: "AspNetUserClaims",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserLogins_UserId",
                table: "AspNetUserLogins",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoDocumentos_CandidatoId",
                table: "CandidatoDocumentos",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoDocumentos_TenantId_CandidatoId",
                table: "CandidatoDocumentos",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_Candidatos_TenantId_Email",
                table: "Candidatos",
                columns: new[] { "TenantId", "Email" });

            migrationBuilder.CreateIndex(
                name: "IX_Candidatos_TenantId_VagaId",
                table: "Candidatos",
                columns: new[] { "TenantId", "VagaId" });

            migrationBuilder.CreateIndex(
                name: "IX_Candidatos_VagaId",
                table: "Candidatos",
                column: "VagaId");

            migrationBuilder.CreateIndex(
                name: "IX_Departments_AreaId",
                table: "Departments",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_Departments_TenantId_Code",
                table: "Departments",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_JobPositions_AreaId",
                table: "JobPositions",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_JobPositions_TenantId_Code",
                table: "JobPositions",
                columns: new[] { "TenantId", "Code" },
                unique: true);

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

            migrationBuilder.CreateIndex(
                name: "IX_Menus_TenantId_PermissionKey",
                table: "Menus",
                columns: new[] { "TenantId", "PermissionKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Menus_TenantId_Route",
                table: "Menus",
                columns: new[] { "TenantId", "Route" });

            migrationBuilder.CreateIndex(
                name: "IX_RoleMenus_MenuId",
                table: "RoleMenus",
                column: "MenuId");

            migrationBuilder.CreateIndex(
                name: "IX_RoleMenus_RoleId",
                table: "RoleMenus",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_RoleMenus_TenantId_RoleId_MenuId_PermissionKey",
                table: "RoleMenus",
                columns: new[] { "TenantId", "RoleId", "MenuId", "PermissionKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Roles_TenantId_NormalizedName",
                table: "Roles",
                columns: new[] { "TenantId", "NormalizedName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "RoleNameIndex",
                table: "Roles",
                column: "NormalizedName");

            migrationBuilder.CreateIndex(
                name: "IX_Units_TenantId_Code",
                table: "Units",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_RoleId",
                table: "UserRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_TenantId_RoleId",
                table: "UserRoles",
                columns: new[] { "TenantId", "RoleId" });

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_TenantId_UserId",
                table: "UserRoles",
                columns: new[] { "TenantId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "Users",
                column: "NormalizedEmail");

            migrationBuilder.CreateIndex(
                name: "IX_Users_TenantId_NormalizedEmail",
                table: "Users",
                columns: new[] { "TenantId", "NormalizedEmail" });

            migrationBuilder.CreateIndex(
                name: "IX_Users_TenantId_NormalizedUserName",
                table: "Users",
                columns: new[] { "TenantId", "NormalizedUserName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                table: "Users",
                column: "NormalizedUserName");

            migrationBuilder.CreateIndex(
                name: "IX_VagaBeneficios_TenantId_VagaId",
                table: "VagaBeneficios",
                columns: new[] { "TenantId", "VagaId" });

            migrationBuilder.CreateIndex(
                name: "IX_VagaBeneficios_VagaId",
                table: "VagaBeneficios",
                column: "VagaId");

            migrationBuilder.CreateIndex(
                name: "IX_VagaEtapas_TenantId_VagaId",
                table: "VagaEtapas",
                columns: new[] { "TenantId", "VagaId" });

            migrationBuilder.CreateIndex(
                name: "IX_VagaEtapas_VagaId",
                table: "VagaEtapas",
                column: "VagaId");

            migrationBuilder.CreateIndex(
                name: "IX_VagaPerguntas_TenantId_VagaId",
                table: "VagaPerguntas",
                columns: new[] { "TenantId", "VagaId" });

            migrationBuilder.CreateIndex(
                name: "IX_VagaPerguntas_VagaId",
                table: "VagaPerguntas",
                column: "VagaId");

            migrationBuilder.CreateIndex(
                name: "IX_VagaRequisitos_TenantId_VagaId",
                table: "VagaRequisitos",
                columns: new[] { "TenantId", "VagaId" });

            migrationBuilder.CreateIndex(
                name: "IX_VagaRequisitos_VagaId",
                table: "VagaRequisitos",
                column: "VagaId");

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_AreaId",
                table: "Vagas",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_DepartmentId",
                table: "Vagas",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_TenantId_AreaId",
                table: "Vagas",
                columns: new[] { "TenantId", "AreaId" });

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_TenantId_DepartmentId",
                table: "Vagas",
                columns: new[] { "TenantId", "DepartmentId" });

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_TenantId_Status",
                table: "Vagas",
                columns: new[] { "TenantId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AspNetRoleClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserLogins");

            migrationBuilder.DropTable(
                name: "AspNetUserTokens");

            migrationBuilder.DropTable(
                name: "CandidatoDocumentos");

            migrationBuilder.DropTable(
                name: "Managers");

            migrationBuilder.DropTable(
                name: "RoleMenus");

            migrationBuilder.DropTable(
                name: "Tenants");

            migrationBuilder.DropTable(
                name: "UserRoles");

            migrationBuilder.DropTable(
                name: "VagaBeneficios");

            migrationBuilder.DropTable(
                name: "VagaEtapas");

            migrationBuilder.DropTable(
                name: "VagaPerguntas");

            migrationBuilder.DropTable(
                name: "VagaRequisitos");

            migrationBuilder.DropTable(
                name: "Candidatos");

            migrationBuilder.DropTable(
                name: "JobPositions");

            migrationBuilder.DropTable(
                name: "Units");

            migrationBuilder.DropTable(
                name: "Menus");

            migrationBuilder.DropTable(
                name: "Roles");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Vagas");

            migrationBuilder.DropTable(
                name: "Departments");

            migrationBuilder.DropTable(
                name: "Areas");
        }
    }
}
