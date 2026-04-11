using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUnidadeLotacaoHierarchyV2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AgendaEventTypes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Label = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Color = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Icon = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgendaEventTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ApiKeys",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    KeyHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastUsedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApiKeys", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AuditTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TransactionId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CorrelationId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    TraceId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SpanId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ParentSpanId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Environment = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    AppVersion = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    DurationMs = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    UserName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ClientId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Ip = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Host = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Method = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Path = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    QueryString = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    RouteTemplate = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    Controller = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Action = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    StatusCode = table.Column<int>(type: "integer", nullable: true),
                    IsSuccess = table.Column<bool>(type: "boolean", nullable: false),
                    RequestContentType = table.Column<string>(type: "text", nullable: true),
                    ResponseContentType = table.Column<string>(type: "text", nullable: true),
                    RequestBody = table.Column<string>(type: "text", nullable: true),
                    ResponseBody = table.Column<string>(type: "text", nullable: true),
                    RequestBodyHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ResponseBodyHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    RequestIsTruncated = table.Column<bool>(type: "boolean", nullable: false),
                    ResponseIsTruncated = table.Column<bool>(type: "boolean", nullable: false),
                    RequestTruncatedBytes = table.Column<int>(type: "integer", nullable: false),
                    ResponseTruncatedBytes = table.Column<int>(type: "integer", nullable: false),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    ErrorStackTrace = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditTransactions", x => x.Id);
                });

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
                name: "Cargos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Description = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    OccupationalClassification = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    CargoType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    SimilarityIndicator = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    FullDescription = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cargos", x => x.Id);
                });

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

            migrationBuilder.CreateTable(
                name: "EmailMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    OwnerUserId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    OwnerUserName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    IsSystem = table.Column<bool>(type: "boolean", nullable: false),
                    Source = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    To = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    Cc = table.Column<string>(type: "character varying(640)", maxLength: 640, nullable: true),
                    Bcc = table.Column<string>(type: "character varying(640)", maxLength: 640, nullable: true),
                    Subject = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    BodyHtml = table.Column<string>(type: "text", nullable: false),
                    BodyText = table.Column<string>(type: "text", nullable: true),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: true),
                    TemplateName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    TemplateVersion = table.Column<int>(type: "integer", nullable: true),
                    PayloadJson = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AttemptCount = table.Column<int>(type: "integer", nullable: false),
                    MaxAttempts = table.Column<int>(type: "integer", nullable: false),
                    NextAttemptAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailMessages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EmailTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    SubjectTemplate = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BodyHtml = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Empresas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Description = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Empresas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EntraIdConfigs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    EntraTenantId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ClientId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ClientSecretEncrypted = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    CallbackPath = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EntraIdConfigs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExceptionLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RequestLogId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    EnvironmentName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    EnvironmentNormalized = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    DeviceId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    DeviceType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Platform = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Browser = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    DeviceAppVersion = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Locale = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IsHandled = table.Column<bool>(type: "boolean", nullable: false),
                    StatusCode = table.Column<int>(type: "integer", nullable: false),
                    ExceptionType = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Message = table.Column<string>(type: "character varying(4096)", maxLength: 4096, nullable: false),
                    StackTrace = table.Column<string>(type: "character varying(16384)", maxLength: 16384, nullable: true),
                    InnerExceptionType = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    InnerMessage = table.Column<string>(type: "character varying(4096)", maxLength: 4096, nullable: true),
                    ProblemTitle = table.Column<string>(type: "character varying(4096)", maxLength: 4096, nullable: true),
                    ProblemDetail = table.Column<string>(type: "character varying(4096)", maxLength: 4096, nullable: true),
                    ProblemType = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ValidationErrorsJson = table.Column<string>(type: "jsonb", nullable: true),
                    Tags = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExceptionLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LocalizationConfigs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Culture = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    UiCulture = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LocalizationConfigs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LogEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RequestLogId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    EnvironmentName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    EnvironmentNormalized = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    DeviceId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    DeviceType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Platform = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Browser = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    DeviceAppVersion = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Locale = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    Level = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Category = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    EventId = table.Column<int>(type: "integer", nullable: true),
                    EventName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Message = table.Column<string>(type: "character varying(8192)", maxLength: 8192, nullable: false),
                    ExceptionType = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ExceptionMessage = table.Column<string>(type: "character varying(8192)", maxLength: 8192, nullable: true),
                    ExceptionStackTrace = table.Column<string>(type: "character varying(16384)", maxLength: 16384, nullable: true),
                    PropertiesJson = table.Column<string>(type: "jsonb", nullable: true),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LogEntries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Menus",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    DisplayNameKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Route = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    Icon = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    ParentId = table.Column<Guid>(type: "uuid", nullable: true),
                    PermissionKey = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    OpenInNewTab = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Menus", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "NiveisCargo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    CdnNivCargo = table.Column<int>(type: "integer", nullable: false),
                    NomReduz = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: false),
                    NomComplet = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NiveisCargo", x => x.Id);
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
                name: "NotificationReceipts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    NotificationId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SeenAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ReadAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationReceipts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Pessoas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Origem = table.Column<int>(type: "integer", nullable: false),
                    Nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Fone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Cidade = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Uf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    LinkedinUrl = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    ResumoProfissional = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Obs = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Cep = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Logradouro = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Numero = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Bairro = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Complemento = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Cpf = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: true),
                    Rg = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    FoneContato = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    DataNascimento = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pessoas", x => x.Id);
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
                name: "RequestLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TransactionId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CorrelationId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    TraceId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    EnvironmentName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    EnvironmentNormalized = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    DeviceId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    DeviceType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Platform = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Browser = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    DeviceAppVersion = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Locale = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    DurationMs = table.Column<long>(type: "bigint", nullable: false),
                    Method = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Path = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    QueryString = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    StatusCode = table.Column<int>(type: "integer", nullable: true),
                    IsSuccess = table.Column<bool>(type: "boolean", nullable: false),
                    UserId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    UserName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ClientId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Ip = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Host = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Controller = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Action = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    RouteTemplate = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    RequestBodySnippet = table.Column<string>(type: "character varying(4096)", maxLength: 4096, nullable: true),
                    ResponseBodySnippet = table.Column<string>(type: "character varying(4096)", maxLength: 4096, nullable: true),
                    ErrorCount = table.Column<int>(type: "integer", nullable: false),
                    WarningCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RequestLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RequisitoCategorias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RequisitoCategorias", x => x.Id);
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
                    VisibilityScope = table.Column<short>(type: "smallint", nullable: false, defaultValue: (short)0),
                    VagasDataScope = table.Column<short>(type: "smallint", nullable: false, defaultValue: (short)0),
                    AccessMode = table.Column<short>(type: "smallint", nullable: false, defaultValue: (short)0),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
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
                name: "Surveys",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Title = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    Type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    StartAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    EndAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    DepartmentsJson = table.Column<string>(type: "jsonb", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Surveys", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TenantAwsSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    AccessKeyIdEncrypted = table.Column<string>(type: "text", nullable: true),
                    SecretAccessKeyEncrypted = table.Column<string>(type: "text", nullable: true),
                    Region = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    BucketName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PresignedUrlExpirationMinutes = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantAwsSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Turnos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Description = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    StartTime = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: true),
                    EndTime = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Turnos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AgendaEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    StartAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AllDay = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Location = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Owner = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Candidate = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    VagaTitle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    VagaCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgendaEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgendaEvents_AgendaEventTypes_TypeId",
                        column: x => x.TypeId,
                        principalTable: "AgendaEventTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AuditEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    AuditTransactionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    EventType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DataJson = table.Column<string>(type: "jsonb", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditEvents_AuditTransactions_AuditTransactionId",
                        column: x => x.AuditTransactionId,
                        principalTable: "AuditTransactions",
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
                name: "EmailAttempts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    EmailMessageId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptNumber = table.Column<int>(type: "integer", nullable: false),
                    Provider = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    StartedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CompletedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IsSuccess = table.Column<bool>(type: "boolean", nullable: false),
                    ErrorMessage = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: true),
                    ErrorStackTrace = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailAttempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmailAttempts_EmailMessages_EmailMessageId",
                        column: x => x.EmailMessageId,
                        principalTable: "EmailMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CentrosCusto",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Description = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Manager = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ValidFrom = table.Column<DateOnly>(type: "date", nullable: true),
                    ValidUntil = table.Column<DateOnly>(type: "date", nullable: true),
                    EmpresaId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CentrosCusto", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CentrosCusto_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
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
                    NomAbrevPessoaJurid = table.Column<string>(type: "text", nullable: true),
                    NomPessoaJurid = table.Column<string>(type: "text", nullable: true),
                    NomAbrevPessoaFisic = table.Column<string>(type: "text", nullable: true),
                    EmpresaId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Units", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Units_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "PessoaBloqueios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PessoaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Motivo = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    OrigemBloqueio = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PessoaBloqueios", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PessoaBloqueios_Pessoas_PessoaId",
                        column: x => x.PessoaId,
                        principalTable: "Pessoas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Talentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PessoaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Origem = table.Column<int>(type: "integer", nullable: false),
                    CvProfileJson = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Versao = table.Column<int>(type: "integer", nullable: false)
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
                name: "PermissoesNivelVaga",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    NivelHierarquicoId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PermissoesNivelVaga", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PermissoesNivelVaga_NiveisHierarquicos_NivelHierarquicoId",
                        column: x => x.NivelHierarquicoId,
                        principalTable: "NiveisHierarquicos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PermissoesNivelVaga_Roles_RoleId",
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

            migrationBuilder.CreateTable(
                name: "SurveyQuestions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SurveyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyQuestions_Surveys_SurveyId",
                        column: x => x.SurveyId,
                        principalTable: "Surveys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SurveyResponses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SurveyId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmittedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyResponses_Surveys_SurveyId",
                        column: x => x.SurveyId,
                        principalTable: "Surveys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AuditEntityChanges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    AuditTransactionId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuditEventId = table.Column<Guid>(type: "uuid", nullable: true),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    EntityName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TableName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    State = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PrimaryKeyJson = table.Column<string>(type: "jsonb", nullable: false),
                    BeforeJson = table.Column<string>(type: "jsonb", nullable: true),
                    AfterJson = table.Column<string>(type: "jsonb", nullable: true),
                    ChangedColumns = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DataJson = table.Column<string>(type: "jsonb", nullable: true),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditEntityChanges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditEntityChanges_AuditEvents_AuditEventId",
                        column: x => x.AuditEventId,
                        principalTable: "AuditEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_AuditEntityChanges_AuditTransactions_AuditTransactionId",
                        column: x => x.AuditTransactionId,
                        principalTable: "AuditTransactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CategoriasSalariais",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Description = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EmpresaId = table.Column<Guid>(type: "uuid", nullable: true),
                    EstabelecimentoId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CategoriasSalariais", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CategoriasSalariais_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CategoriasSalariais_Units_EstabelecimentoId",
                        column: x => x.EstabelecimentoId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "TalentoCompetencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TalentoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Nivel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Evidencia = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    TempoAtuacao = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TalentoCompetencias", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TalentoCompetencias_Talentos_TalentoId",
                        column: x => x.TalentoId,
                        principalTable: "Talentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TalentoDocumentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TalentoId = table.Column<Guid>(type: "uuid", nullable: false),
                    NomeArquivo = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Descricao = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    StorageFileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    TamanhoBytes = table.Column<long>(type: "bigint", nullable: true),
                    DataReferencia = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TalentoDocumentos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TalentoDocumentos_Talentos_TalentoId",
                        column: x => x.TalentoId,
                        principalTable: "Talentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TalentoExperiencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TalentoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Empresa = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Cargo = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Inicio = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Fim = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    TipoContratacao = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Local = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Atividades = table.Column<string>(type: "character varying(2400)", maxLength: 2400, nullable: true),
                    ResumoAtividades = table.Column<string>(type: "character varying(800)", maxLength: 800, nullable: true),
                    NivelSenioridade = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    NivelHierarquico = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TalentoExperiencias", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TalentoExperiencias_Talentos_TalentoId",
                        column: x => x.TalentoId,
                        principalTable: "Talentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TalentoFormacoes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TalentoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Curso = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Instituicao = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Tipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Inicio = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Fim = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Observacoes = table.Column<string>(type: "character varying(800)", maxLength: 800, nullable: true),
                    Link = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TalentoFormacoes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TalentoFormacoes_Talentos_TalentoId",
                        column: x => x.TalentoId,
                        principalTable: "Talentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TalentoTreinamentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TalentoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Instituicao = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Ano = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Link = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TalentoTreinamentos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TalentoTreinamentos_Talentos_TalentoId",
                        column: x => x.TalentoId,
                        principalTable: "Talentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SurveyOptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyOptions_SurveyQuestions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "SurveyQuestions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SurveyAnswers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ResponseId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    OptionId = table.Column<Guid>(type: "uuid", nullable: true),
                    TextAnswer = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyAnswers_SurveyResponses_ResponseId",
                        column: x => x.ResponseId,
                        principalTable: "SurveyResponses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AuditEntityPropertyChanges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    AuditEntityChangeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BeforeValue = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    AfterValue = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IsSensitive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditEntityPropertyChanges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditEntityPropertyChanges_AuditEntityChanges_AuditEntityCh~",
                        column: x => x.AuditEntityChangeId,
                        principalTable: "AuditEntityChanges",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TalentoCvImportJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TalentoId = table.Column<Guid>(type: "uuid", nullable: false),
                    TalentoDocumentoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    EnviarParaGpt = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    StartedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    FinishedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    SimilarTalentoId = table.Column<Guid>(type: "uuid", nullable: true),
                    SuggestedDataJson = table.Column<string>(type: "text", nullable: true),
                    ErrorMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TalentoCvImportJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TalentoCvImportJobs_TalentoDocumentos_TalentoDocumentoId",
                        column: x => x.TalentoDocumentoId,
                        principalTable: "TalentoDocumentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TalentoCvImportJobs_Talentos_TalentoId",
                        column: x => x.TalentoId,
                        principalTable: "Talentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AprovacoesFaixaSalarial",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FaixaSalarialId = table.Column<Guid>(type: "uuid", nullable: false),
                    SolicitanteId = table.Column<Guid>(type: "uuid", nullable: true),
                    ValorProposto = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Justificativa = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    AprovadorId = table.Column<Guid>(type: "uuid", nullable: true),
                    ObservacaoAprovador = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AprovadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AprovacoesFaixaSalarial", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Areas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    ParentId = table.Column<Guid>(type: "uuid", nullable: true),
                    OwnerFuncionarioId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Areas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Areas_Areas_ParentId",
                        column: x => x.ParentId,
                        principalTable: "Areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
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
                    OccupationalClassification = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    DescricaoPublicacao = table.Column<string>(type: "text", nullable: true),
                    NivelHierarquicoId = table.Column<Guid>(type: "uuid", nullable: true),
                    SimilarityIndicator = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    FullDescription = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    NivelCargoId = table.Column<Guid>(type: "uuid", nullable: true),
                    DesEnvelPagto = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
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
                    table.ForeignKey(
                        name: "FK_JobPositions_NiveisCargo_NivelCargoId",
                        column: x => x.NivelCargoId,
                        principalTable: "NiveisCargo",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_JobPositions_NiveisHierarquicos_NivelHierarquicoId",
                        column: x => x.NivelHierarquicoId,
                        principalTable: "NiveisHierarquicos",
                        principalColumn: "Id");
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
                });

            migrationBuilder.CreateTable(
                name: "AvaliacaoCiclos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Nome = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Periodo = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    CriadoPorId = table.Column<Guid>(type: "uuid", nullable: false),
                    CriadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AtualizadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AvaliacaoCiclos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AvaliacaoPerguntas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CicloId = table.Column<Guid>(type: "uuid", nullable: false),
                    Texto = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Ordem = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AvaliacaoPerguntas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AvaliacaoPerguntas_AvaliacaoCiclos_CicloId",
                        column: x => x.CicloId,
                        principalTable: "AvaliacaoCiclos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AvaliacaoRespostas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CicloId = table.Column<Guid>(type: "uuid", nullable: false),
                    AvaliadorId = table.Column<Guid>(type: "uuid", nullable: false),
                    AvaliandoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Score = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    RespostasJson = table.Column<string>(type: "text", nullable: false),
                    CriadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AvaliacaoRespostas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AvaliacaoRespostas_AvaliacaoCiclos_CicloId",
                        column: x => x.CicloId,
                        principalTable: "AvaliacaoCiclos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

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
                    IsReadOnly = table.Column<bool>(type: "boolean", nullable: false),
                    ValorPadrao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Ordem = table.Column<int>(type: "integer", nullable: false),
                    Opcoes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CamposPersonalizadosVaga", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoAcessibilidades",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Idioma = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Canal = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    MelhorHorario = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    ObservacoesComunicacao = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    PrecisaLegendas = table.Column<bool>(type: "boolean", nullable: false),
                    PrecisaInterprete = table.Column<bool>(type: "boolean", nullable: false),
                    PrecisaLeitorTela = table.Column<bool>(type: "boolean", nullable: false),
                    PrecisaBaixaEstimulo = table.Column<bool>(type: "boolean", nullable: false),
                    PrecisaMobilidade = table.Column<bool>(type: "boolean", nullable: false),
                    PrecisaTempoExtra = table.Column<bool>(type: "boolean", nullable: false),
                    DetalhesNecessidades = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: true),
                    ConsentimentoPcd = table.Column<bool>(type: "boolean", nullable: false),
                    PcdIdentificacao = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    PcdTipo = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    PcdComprovacao = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    PcdObservacoes = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoAcessibilidades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoAgendaBloqueios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Titulo = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Data = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Horario = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Observacoes = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoAgendaBloqueios", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoAgendaPreferencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    FormatoEntrevista = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    InicioDisponivel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    AvisoPrevio = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Observacoes = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    DiaSeg = table.Column<bool>(type: "boolean", nullable: false),
                    DiaTer = table.Column<bool>(type: "boolean", nullable: false),
                    DiaQua = table.Column<bool>(type: "boolean", nullable: false),
                    DiaQui = table.Column<bool>(type: "boolean", nullable: false),
                    DiaSex = table.Column<bool>(type: "boolean", nullable: false),
                    DiaSab = table.Column<bool>(type: "boolean", nullable: false),
                    DiaDom = table.Column<bool>(type: "boolean", nullable: false),
                    PeriodoManha = table.Column<bool>(type: "boolean", nullable: false),
                    PeriodoTarde = table.Column<bool>(type: "boolean", nullable: false),
                    PeriodoNoite = table.Column<bool>(type: "boolean", nullable: false),
                    HorarioPreferido = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    FusoHorario = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoAgendaPreferencias", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoCertificacoes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Instituicao = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Ano = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Link = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoCertificacoes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoCompetencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Nivel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Evidencia = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoCompetencias", x => x.Id);
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
                    ArquivoNome = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    DataReferencia = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoDocumentos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoEducacaoItens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Curso = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Instituicao = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Tipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Inicio = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Fim = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Observacoes = table.Column<string>(type: "character varying(800)", maxLength: 800, nullable: true),
                    Link = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoEducacaoItens", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoEducacaoResumos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nivel = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    AreaPrincipal = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Situacao = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Destaques = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoEducacaoResumos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoExperiencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Empresa = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Cargo = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Inicio = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Fim = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Local = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Atividades = table.Column<string>(type: "character varying(2400)", maxLength: 2400, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoExperiencias", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoLgpdConsents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProcessarCandidatura = table.Column<bool>(type: "boolean", nullable: false),
                    PermitirContato = table.Column<bool>(type: "boolean", nullable: false),
                    BancoTalentos = table.Column<bool>(type: "boolean", nullable: false),
                    RetencaoMeses = table.Column<int>(type: "integer", nullable: true),
                    Compartilhamento = table.Column<short>(type: "smallint", nullable: true),
                    DadosSensiveis = table.Column<bool>(type: "boolean", nullable: false),
                    Comunicacoes = table.Column<bool>(type: "boolean", nullable: false),
                    ConsentidoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RevogadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoLgpdConsents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoNotificacaoPreferencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    CanalEmail = table.Column<bool>(type: "boolean", nullable: false),
                    CanalWhatsapp = table.Column<bool>(type: "boolean", nullable: false),
                    CanalSms = table.Column<bool>(type: "boolean", nullable: false),
                    CanalPush = table.Column<bool>(type: "boolean", nullable: false),
                    Frequencia = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Idioma = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    Telefone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    PermiteContato = table.Column<bool>(type: "boolean", nullable: false),
                    AlertaNovasVagas = table.Column<bool>(type: "boolean", nullable: false),
                    AlertaAtualizacoes = table.Column<bool>(type: "boolean", nullable: false),
                    AlertaEntrevistas = table.Column<bool>(type: "boolean", nullable: false),
                    AlertaMensagens = table.Column<bool>(type: "boolean", nullable: false),
                    AlertaDocumentos = table.Column<bool>(type: "boolean", nullable: false),
                    AlertaLembretes = table.Column<bool>(type: "boolean", nullable: false),
                    SilencioAtivo = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    SilencioInicio = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    SilencioFim = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    SilencioPrioridade = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Assinatura = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoNotificacaoPreferencias", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoPortfolios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkModel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Availability = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Salary = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Shift = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Linkedin = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    Github = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    Portfolio = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    Drive = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    Tags = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoPortfolios", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoPreferenciasVaga",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    CargoAlvo = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Senioridade = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    InicioDisponivel = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Resumo = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: true),
                    AreasInteresse = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    ModeloTrabalho = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Jornada = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    TipoContrato = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Viagens = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Mudanca = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    CidadePreferida = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    DistanciaMaxKm = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ObsDeslocamento = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PretensaoSalarial = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    PretensaoNegociavel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    BeneficiosDesejados = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    NaoAbreMaoDe = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoPreferenciasVaga", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoProjetos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Periodo = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Descricao = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: true),
                    Link = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    Stack = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Destaques = table.Column<string>(type: "character varying(1600)", maxLength: 1600, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoProjetos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoReferencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Relacao = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Empresa = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Cargo = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Contato = table.Column<string>(type: "character varying(220)", maxLength: 220, nullable: true),
                    Periodo = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Linkedin = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    Observacoes = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: true),
                    PodeContatar = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoReferencias", x => x.Id);
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
                    LinkedinUrl = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    ResumoProfissional = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    AvatarFileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    AvatarContentType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Fonte = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TrabalhandoAtualmente = table.Column<bool>(type: "boolean", nullable: true),
                    PretensaoSalarial = table.Column<decimal>(type: "numeric", nullable: true),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: true),
                    TalentoId = table.Column<Guid>(type: "uuid", nullable: true),
                    Obs = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CvText = table.Column<string>(type: "text", nullable: true),
                    PortalAccessKey = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    PortalPasswordHash = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    LastMatchScore = table.Column<int>(type: "integer", nullable: true),
                    LastMatchPass = table.Column<bool>(type: "boolean", nullable: true),
                    LastMatchAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastMatchVagaId = table.Column<Guid>(type: "uuid", nullable: true),
                    ApplicationRecruiterUserId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ApplicationRecruiterUserName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Candidatos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Candidatos_Talentos_TalentoId",
                        column: x => x.TalentoId,
                        principalTable: "Talentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoStatusHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromStatus = table.Column<int>(type: "integer", nullable: false),
                    ToStatus = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Note = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Source = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    UserId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    UserName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoStatusHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidatoStatusHistories_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoVagaMatchingScores",
                columns: table => new
                {
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Score = table.Column<int>(type: "integer", nullable: false),
                    ScoreCompetencia = table.Column<int>(type: "integer", nullable: true),
                    ScoreExperiencia = table.Column<int>(type: "integer", nullable: true),
                    ScoreFormacao = table.Column<int>(type: "integer", nullable: true),
                    ScoreLocalidade = table.Column<int>(type: "integer", nullable: true),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Justificativa = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    RuleVersion = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    CalculatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoVagaMatchingScores", x => new { x.CandidatoId, x.VagaId });
                    table.ForeignKey(
                        name: "FK_CandidatoVagaMatchingScores_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CelebrationCommentMentions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CommentId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CelebrationCommentMentions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CelebrationCommentReactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CommentId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CelebrationCommentReactions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CelebrationComments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PostId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Content = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CelebrationComments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CelebrationMentions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PostId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CelebrationMentions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CelebrationPosts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    AuthorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Content = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CelebrationPosts", x => x.Id);
                });

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
                });

            migrationBuilder.CreateTable(
                name: "DevelopmentPlanGoals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    DueDate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ConcludedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DevelopmentPlanGoals", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DevelopmentPlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    OwnerUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DevelopmentPlans", x => x.Id);
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
                    Descricao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SlaDias = table.Column<int>(type: "integer", nullable: true),
                    Observacoes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FasesProcesso", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackItemRatings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FeedbackItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Stars = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackItemRatings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FromUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Content = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Tipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    IsPresencial = table.Column<bool>(type: "boolean", nullable: false),
                    InternalNotes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Funcionarios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PessoaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Email = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Headcount = table.Column<int>(type: "integer", nullable: false),
                    JobPositionId = table.Column<Guid>(type: "uuid", nullable: true),
                    RequisitoCategoriaId = table.Column<Guid>(type: "uuid", nullable: true),
                    NivelHierarquicoId = table.Column<Guid>(type: "uuid", nullable: true),
                    GestorDiretoId = table.Column<Guid>(type: "uuid", nullable: true),
                    AvatarFileName = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CdnFuncionario = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: true),
                    CdnEmpresa = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: true),
                    CdnEstab = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: true),
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
                        name: "FK_Funcionarios_Funcionarios_GestorDiretoId",
                        column: x => x.GestorDiretoId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Funcionarios_JobPositions_JobPositionId",
                        column: x => x.JobPositionId,
                        principalTable: "JobPositions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Funcionarios_NiveisHierarquicos_NivelHierarquicoId",
                        column: x => x.NivelHierarquicoId,
                        principalTable: "NiveisHierarquicos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Funcionarios_Pessoas_PessoaId",
                        column: x => x.PessoaId,
                        principalTable: "Pessoas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Funcionarios_RequisitoCategorias_RequisitoCategoriaId",
                        column: x => x.RequisitoCategoriaId,
                        principalTable: "RequisitoCategorias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Funcionarios_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Metas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FuncionarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    CriadaPorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Titulo = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Descricao = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ValorMeta = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    ValorAtual = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    Unidade = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Prazo = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    CriadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AtualizadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Metas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Metas_Funcionarios_CriadaPorId",
                        column: x => x.CriadaPorId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Metas_Funcionarios_FuncionarioId",
                        column: x => x.FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "NineBoxAssessments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FuncionarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    AvaliadorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Desempenho = table.Column<int>(type: "integer", nullable: false),
                    Potencial = table.Column<int>(type: "integer", nullable: false),
                    Observacoes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CriadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AtualizadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NineBoxAssessments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NineBoxAssessments_Funcionarios_AvaliadorId",
                        column: x => x.AvaliadorId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_NineBoxAssessments_Funcionarios_FuncionarioId",
                        column: x => x.FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
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
                    CodCargoTotvs = table.Column<int>(type: "integer", nullable: true),
                    CodVinculoEmpregaticio = table.Column<int>(type: "integer", nullable: true),
                    TipoFuncionario = table.Column<int>(type: "integer", nullable: true),
                    CategoriaSalarial = table.Column<int>(type: "integer", nullable: true),
                    GrauInstrucao = table.Column<int>(type: "integer", nullable: true),
                    CodTurno = table.Column<int>(type: "integer", nullable: true),
                    CentroCusto = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    UnidadeLotacao = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    TituloEleitorNumero = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    TituloEleitorZona = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    TituloEleitorSecao = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    ReservistaNumero = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CategoriaCnh = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    ValidadeCnh = table.Column<DateOnly>(type: "date", nullable: true),
                    Ctps = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CtpsSerie = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    CtpsUf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    GrupoSanguineo = table.Column<int>(type: "integer", nullable: true),
                    FatorRh = table.Column<int>(type: "integer", nullable: true),
                    PossuiDeficiencia = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    DocMilitarTipo = table.Column<int>(type: "integer", nullable: true),
                    DocMilitarNumero = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    DocMilitarSerie = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    DocMilitarRegiao = table.Column<int>(type: "integer", nullable: true),
                    CartaoSus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    TituloEleitorCidade = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    TituloEleitorUf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    CtpsModelo = table.Column<int>(type: "integer", nullable: true),
                    Altura = table.Column<int>(type: "integer", nullable: true),
                    Peso = table.Column<int>(type: "integer", nullable: true),
                    ValidacaoCpfOk = table.Column<bool>(type: "boolean", nullable: false),
                    ValidacaoCepOk = table.Column<bool>(type: "boolean", nullable: false),
                    ValidacaoBancoOk = table.Column<bool>(type: "boolean", nullable: false),
                    ValidacaoSalarioOk = table.Column<bool>(type: "boolean", nullable: false),
                    ValidacaoSalarioJustificativa = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CodEmpresa = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    RgUfExpedidor = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    OrigemFuncionario = table.Column<int>(type: "integer", nullable: true),
                    PaisNascimento = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Cutis = table.Column<int>(type: "integer", nullable: true),
                    Cabelo = table.Column<int>(type: "integer", nullable: true),
                    Olhos = table.Column<int>(type: "integer", nullable: true),
                    Manequim = table.Column<int>(type: "integer", nullable: true),
                    Sapato = table.Column<int>(type: "integer", nullable: true),
                    CtpsSerieESocial = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    CodPlanoLotacao = table.Column<int>(type: "integer", nullable: true),
                    CodTurma = table.Column<int>(type: "integer", nullable: true),
                    NumCartaoPonto = table.Column<int>(type: "integer", nullable: true),
                    CodNivel = table.Column<int>(type: "integer", nullable: true),
                    TipoMaoDeObra = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    FormaPagamento = table.Column<int>(type: "integer", nullable: true),
                    SalarioSimulado = table.Column<decimal>(type: "numeric", nullable: true),
                    OptanteFgts = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    TipoAdmissaoFgts = table.Column<int>(type: "integer", nullable: true),
                    RecolheFgts = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    RecolheInss = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    FuncQualificado = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    IndFuncVinculado = table.Column<int>(type: "integer", nullable: true),
                    FuncDoador = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    Sindicalizado = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    DescContribSindical = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    ContribSindicDia = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    CodSindicato = table.Column<int>(type: "integer", nullable: true),
                    CargaAutomTurno = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    RecebePericul = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    RecebeInsalub = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    RecebeAdiantamento = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    ConsidEmissRAIS = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    Calcula13 = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    RecebeFerias = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    Avos13SalCalcAnterior = table.Column<int>(type: "integer", nullable: true),
                    Avos13SalCalc = table.Column<int>(type: "integer", nullable: true),
                    ProvAcum13Sal = table.Column<decimal>(type: "numeric", nullable: true),
                    ProvAcumInss13Sal = table.Column<decimal>(type: "numeric", nullable: true),
                    ProvAcumFgts13Sal = table.Column<decimal>(type: "numeric", nullable: true),
                    DiasProvFeriasMesAnterior = table.Column<decimal>(type: "numeric", nullable: true),
                    DiasProvFeriasMesAtual = table.Column<decimal>(type: "numeric", nullable: true),
                    ProvAcumFerias = table.Column<decimal>(type: "numeric", nullable: true),
                    ProvAcumInssFerias = table.Column<decimal>(type: "numeric", nullable: true),
                    ProvAcumFgtsFerias = table.Column<decimal>(type: "numeric", nullable: true),
                    ProvAcumFerias13 = table.Column<decimal>(type: "numeric", nullable: true),
                    EmitCartPonto = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    CodLocalMarcacao = table.Column<int>(type: "integer", nullable: true),
                    CodClassFuncPontoEletronico = table.Column<int>(type: "integer", nullable: true),
                    CnhNumero = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CnhUf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    CnhOrgaoEmissor = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CnhDataExpedicao = table.Column<int>(type: "integer", nullable: true),
                    CnhPrimeiraHabilitacao = table.Column<int>(type: "integer", nullable: true),
                    NomeAbreviado = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    DataTerminoContrato = table.Column<int>(type: "integer", nullable: true),
                    PaisLocalidade = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    CodLocalidade = table.Column<int>(type: "integer", nullable: true),
                    CodFpas = table.Column<int>(type: "integer", nullable: true),
                    CategoriaTrabalhoESocial = table.Column<int>(type: "integer", nullable: true),
                    IndAdmissao = table.Column<int>(type: "integer", nullable: true),
                    NaturezaAtividade = table.Column<int>(type: "integer", nullable: true),
                    MunicipioNascimentoIbge = table.Column<int>(type: "integer", nullable: true),
                    TipoLogradouroESocial = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: true),
                    MunicipioEnderecoIbge = table.Column<int>(type: "integer", nullable: true),
                    EmailAlternativo = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    TipoAdmissaoESocial = table.Column<int>(type: "integer", nullable: true),
                    RegimeTrabalhista = table.Column<int>(type: "integer", nullable: true),
                    RegimePrevidenciario = table.Column<int>(type: "integer", nullable: true),
                    RegimeJornada = table.Column<int>(type: "integer", nullable: true),
                    MatriculaESocial = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    TipoVistoEstrangeiro = table.Column<int>(type: "integer", nullable: true),
                    OcorrenciaCAGED = table.Column<int>(type: "integer", nullable: true),
                    PontoReferencia = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    DddTelefone = table.Column<int>(type: "integer", nullable: true),
                    DddTelContato = table.Column<int>(type: "integer", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SubmittedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IntegracaoResultado = table.Column<short>(type: "smallint", nullable: true),
                    IntegracaoMensagem = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IntegradaEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AccessToken = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
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
                name: "RegrasAprovacaoVaga",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SolicitanteRoleId = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador1FuncionarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Aprovador2FuncionarioId = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador2Habilitado = table.Column<bool>(type: "boolean", nullable: false),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegrasAprovacaoVaga", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RegrasAprovacaoVaga_Funcionarios_Aprovador1FuncionarioId",
                        column: x => x.Aprovador1FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RegrasAprovacaoVaga_Funcionarios_Aprovador2FuncionarioId",
                        column: x => x.Aprovador2FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RegrasAprovacaoVaga_Roles_SolicitanteRoleId",
                        column: x => x.SolicitanteRoleId,
                        principalTable: "Roles",
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
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IntegracaoResultado = table.Column<short>(type: "smallint", nullable: true),
                    IntegracaoMensagem = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IntegradaEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
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
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IntegracaoResultado = table.Column<short>(type: "smallint", nullable: true),
                    IntegracaoMensagem = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IntegradaEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
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
                    PossuiEstabilidade = table.Column<bool>(type: "boolean", nullable: false),
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
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IntegracaoResultado = table.Column<short>(type: "smallint", nullable: true),
                    IntegracaoMensagem = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IntegradaEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
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
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IntegracaoResultado = table.Column<short>(type: "smallint", nullable: true),
                    IntegracaoMensagem = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IntegradaEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
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
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IntegracaoResultado = table.Column<short>(type: "smallint", nullable: true),
                    IntegracaoMensagem = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IntegradaEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
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
                name: "SolicitacoesPagamentoExtra",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    SolicitanteId = table.Column<Guid>(type: "uuid", nullable: false),
                    FuncionarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    TipoPagamentoExtra = table.Column<short>(type: "smallint", nullable: false),
                    Valor = table.Column<decimal>(type: "numeric", nullable: false),
                    Descricao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    DataPagamento = table.Column<DateOnly>(type: "date", nullable: false),
                    Competencia = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
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
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IntegracaoResultado = table.Column<short>(type: "smallint", nullable: true),
                    IntegracaoMensagem = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IntegradaEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitacoesPagamentoExtra", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SolicitacoesPagamentoExtra_Funcionarios_Aprovador1Id",
                        column: x => x.Aprovador1Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesPagamentoExtra_Funcionarios_Aprovador2Id",
                        column: x => x.Aprovador2Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesPagamentoExtra_Funcionarios_FuncionarioId",
                        column: x => x.FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SolicitacoesPagamentoExtra_Funcionarios_SolicitanteId",
                        column: x => x.SolicitanteId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UnidadesLotacao",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Description = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Location = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    ParentId = table.Column<Guid>(type: "uuid", nullable: true),
                    Level = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    SequenceNumber = table.Column<int>(type: "integer", nullable: true),
                    OwnerFuncionarioId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnidadesLotacao", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UnidadesLotacao_Funcionarios_OwnerFuncionarioId",
                        column: x => x.OwnerFuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_UnidadesLotacao_UnidadesLotacao_ParentId",
                        column: x => x.ParentId,
                        principalTable: "UnidadesLotacao",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    FuncionarioId = table.Column<Guid>(type: "uuid", nullable: true),
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
                    table.ForeignKey(
                        name: "FK_Users_Funcionarios_FuncionarioId",
                        column: x => x.FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
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

            migrationBuilder.CreateTable(
                name: "PreAdmissaoDocumentosSolicitados",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PreAdmissaoId = table.Column<Guid>(type: "uuid", nullable: false),
                    TipoDocumento = table.Column<short>(type: "smallint", nullable: false),
                    Obrigatorio = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PreAdmissaoDocumentosSolicitados", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PreAdmissaoDocumentosSolicitados_PreAdmissoes_PreAdmissaoId",
                        column: x => x.PreAdmissaoId,
                        principalTable: "PreAdmissoes",
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
                    NovaUnidadeId = table.Column<Guid>(type: "uuid", nullable: true),
                    EmpresaId = table.Column<Guid>(type: "uuid", nullable: true),
                    CentroCustoId = table.Column<Guid>(type: "uuid", nullable: true),
                    UnidadeLotacaoId = table.Column<Guid>(type: "uuid", nullable: true),
                    MotivoMovimentacao = table.Column<short>(type: "smallint", nullable: true),
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
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IntegracaoResultado = table.Column<short>(type: "smallint", nullable: true),
                    IntegracaoMensagem = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IntegradaEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
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
                        name: "FK_SolicitacoesPromocao_CentrosCusto_CentroCustoId",
                        column: x => x.CentroCustoId,
                        principalTable: "CentrosCusto",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesPromocao_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
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
                    table.ForeignKey(
                        name: "FK_SolicitacoesPromocao_UnidadesLotacao_UnidadeLotacaoId",
                        column: x => x.UnidadeLotacaoId,
                        principalTable: "UnidadesLotacao",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesPromocao_Units_NovaUnidadeId",
                        column: x => x.NovaUnidadeId,
                        principalTable: "Units",
                        principalColumn: "Id");
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
                    EmpresaId = table.Column<Guid>(type: "uuid", nullable: true),
                    CentroCustoId = table.Column<Guid>(type: "uuid", nullable: true),
                    UnidadeLotacaoId = table.Column<Guid>(type: "uuid", nullable: true),
                    Titulo = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Justificativa = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    QtdPosicoes = table.Column<int>(type: "integer", nullable: false),
                    Urgencia = table.Column<short>(type: "smallint", nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: true),
                    ObservacaoAprovador = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    TipoSolicitacao = table.Column<short>(type: "smallint", nullable: false),
                    IsConfidencial = table.Column<bool>(type: "boolean", nullable: false),
                    SubstituidoFuncionarioId = table.Column<Guid>(type: "uuid", nullable: true),
                    SubstituidoNome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    TipoContrato = table.Column<short>(type: "smallint", nullable: false),
                    PrazoDias = table.Column<int>(type: "integer", nullable: true),
                    MotivoRequisicao = table.Column<short>(type: "smallint", nullable: true),
                    CnhObrigatoria = table.Column<bool>(type: "boolean", nullable: false),
                    DisponibilidadeViagens = table.Column<bool>(type: "boolean", nullable: false),
                    EscalaTrabalho = table.Column<string>(type: "text", nullable: true),
                    Aprovador1Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador1Status = table.Column<short>(type: "smallint", nullable: false),
                    Aprovador1DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador2Status = table.Column<short>(type: "smallint", nullable: true),
                    Aprovador2DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Habilitado = table.Column<bool>(type: "boolean", nullable: false),
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
                        name: "FK_SolicitacoesVaga_CentrosCusto_CentroCustoId",
                        column: x => x.CentroCustoId,
                        principalTable: "CentrosCusto",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesVaga_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesVaga_Funcionarios_Aprovador1Id",
                        column: x => x.Aprovador1Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SolicitacoesVaga_Funcionarios_Aprovador2Id",
                        column: x => x.Aprovador2Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
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
                        name: "FK_SolicitacoesVaga_Funcionarios_SubstituidoFuncionarioId",
                        column: x => x.SubstituidoFuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SolicitacoesVaga_JobPositions_JobPositionId",
                        column: x => x.JobPositionId,
                        principalTable: "JobPositions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SolicitacoesVaga_UnidadesLotacao_UnidadeLotacaoId",
                        column: x => x.UnidadeLotacaoId,
                        principalTable: "UnidadesLotacao",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesVaga_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "GamificationDailyStates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CurrentStreak = table.Column<int>(type: "integer", nullable: false),
                    BestStreak = table.Column<int>(type: "integer", nullable: false),
                    LastCheckInDate = table.Column<DateOnly>(type: "date", nullable: true),
                    LastActivityDate = table.Column<DateOnly>(type: "date", nullable: true),
                    FeedbackSentToday = table.Column<int>(type: "integer", nullable: false),
                    CelebrationPostsToday = table.Column<int>(type: "integer", nullable: false),
                    CelebrationCommentsToday = table.Column<int>(type: "integer", nullable: false),
                    OneOnOneCompletedToday = table.Column<int>(type: "integer", nullable: false),
                    DevelopmentPlansCreatedToday = table.Column<int>(type: "integer", nullable: false),
                    SurveyAnsweredToday = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GamificationDailyStates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GamificationDailyStates_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MoodEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Mood = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MoodEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MoodEntries_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Level = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notifications_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OneOnOneMeetings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ManagerId = table.Column<Guid>(type: "uuid", nullable: false),
                    CollaboratorId = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingDate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Subject = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OneOnOneMeetings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OneOnOneMeetings_Users_CollaboratorId",
                        column: x => x.CollaboratorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OneOnOneMeetings_Users_ManagerId",
                        column: x => x.ManagerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RenderCoinBalances",
                columns: table => new
                {
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Balance = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RenderCoinBalances", x => new { x.TenantId, x.UserId });
                    table.ForeignKey(
                        name: "FK_RenderCoinBalances_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RenderCoinTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    Reason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SourceType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    SourceId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RenderCoinTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RenderCoinTransactions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
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
                name: "UserUnits",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserUnits", x => new { x.UserId, x.UnitId });
                    table.ForeignKey(
                        name: "FK_UserUnits_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserUnits_Users_UserId",
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
                    NomeEngessado = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DepartmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    AreaTime = table.Column<short>(type: "smallint", nullable: true),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Modalidade = table.Column<short>(type: "smallint", nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    Senioridade = table.Column<short>(type: "smallint", nullable: true),
                    QuantidadeVagas = table.Column<int>(type: "integer", nullable: false),
                    TipoContratacao = table.Column<short>(type: "smallint", nullable: true),
                    MatchMinimoPercentual = table.Column<int>(type: "integer", nullable: false),
                    PesoCompetencia = table.Column<int>(type: "integer", nullable: false),
                    PesoExperiencia = table.Column<int>(type: "integer", nullable: false),
                    PesoFormacao = table.Column<int>(type: "integer", nullable: false),
                    PesoLocalidade = table.Column<int>(type: "integer", nullable: false),
                    MatchingFiltrosRaw = table.Column<string>(type: "text", nullable: true),
                    MatchingFiltrosOriginaisRaw = table.Column<string>(type: "text", nullable: true),
                    DescricaoInterna = table.Column<string>(type: "text", nullable: true),
                    CodigoInterno = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    CodigoCbo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    JobPositionId = table.Column<Guid>(type: "uuid", nullable: true),
                    CategoriaSalarialId = table.Column<Guid>(type: "uuid", nullable: true),
                    CentroCustoId = table.Column<Guid>(type: "uuid", nullable: true),
                    TurnoId = table.Column<Guid>(type: "uuid", nullable: true),
                    UnidadeLotacaoId = table.Column<Guid>(type: "uuid", nullable: true),
                    MotivoAbertura = table.Column<short>(type: "smallint", nullable: true),
                    OrcamentoAprovado = table.Column<short>(type: "smallint", nullable: true),
                    GestorRequisitante = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    RecrutadorResponsavel = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    RecrutadorResponsavelUserId = table.Column<Guid>(type: "uuid", nullable: true),
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
                    DataAbertura = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    SlaDiasMetaFechamento = table.Column<int>(type: "integer", nullable: true),
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
                        name: "FK_Vagas_CategoriasSalariais_CategoriaSalarialId",
                        column: x => x.CategoriaSalarialId,
                        principalTable: "CategoriasSalariais",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Vagas_CentrosCusto_CentroCustoId",
                        column: x => x.CentroCustoId,
                        principalTable: "CentrosCusto",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Vagas_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Vagas_JobPositions_JobPositionId",
                        column: x => x.JobPositionId,
                        principalTable: "JobPositions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Vagas_Turnos_TurnoId",
                        column: x => x.TurnoId,
                        principalTable: "Turnos",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Vagas_UnidadesLotacao_UnidadeLotacaoId",
                        column: x => x.UnidadeLotacaoId,
                        principalTable: "UnidadesLotacao",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Vagas_Users_RecrutadorResponsavelUserId",
                        column: x => x.RecrutadorResponsavelUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "InboxItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Origem = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RecebidoEm = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Remetente = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    Assunto = table.Column<string>(type: "character varying(220)", maxLength: 220, nullable: true),
                    Destinatario = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: true),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: true),
                    PreviewText = table.Column<string>(type: "text", nullable: true),
                    ProcessamentoPct = table.Column<int>(type: "integer", nullable: false),
                    ProcessamentoEtapa = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ProcessamentoTentativas = table.Column<int>(type: "integer", nullable: false),
                    ProcessamentoUltimoErro = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    ProcessamentoLogRaw = table.Column<string>(type: "text", nullable: true),
                    SuggestedVagasJson = table.Column<string>(type: "jsonb", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InboxItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InboxItems_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_InboxItems_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
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
                name: "RespostasCampoPersonalizadoVaga",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    CampoId = table.Column<Guid>(type: "uuid", nullable: false),
                    ValorTexto = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RespostasCampoPersonalizadoVaga", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RespostasCampoPersonalizadoVaga_CamposPersonalizadosVaga_Ca~",
                        column: x => x.CampoId,
                        principalTable: "CamposPersonalizadosVaga",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RespostasCampoPersonalizadoVaga_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RespostasCampoPersonalizadoVaga_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
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
                    Categoria = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
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
                name: "VagaUnifiedMatchingCaches",
                columns: table => new
                {
                    VagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CurrentFiltersHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PendingFiltersHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StartedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ComputedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastAccessAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ItemsJson = table.Column<string>(type: "jsonb", nullable: true),
                    LastError = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VagaUnifiedMatchingCaches", x => x.VagaId);
                    table.ForeignKey(
                        name: "FK_VagaUnifiedMatchingCaches_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InboxAttachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    InboxItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Tipo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    TamanhoKB = table.Column<int>(type: "integer", nullable: false),
                    Hash = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InboxAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InboxAttachments_InboxItems_InboxItemId",
                        column: x => x.InboxItemId,
                        principalTable: "InboxItems",
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
                name: "IX_AgendaEvents_TenantId_StartAtUtc",
                table: "AgendaEvents",
                columns: new[] { "TenantId", "StartAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_AgendaEvents_TypeId",
                table: "AgendaEvents",
                column: "TypeId");

            migrationBuilder.CreateIndex(
                name: "IX_AgendaEventTypes_TenantId_Code",
                table: "AgendaEventTypes",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ApiKeys_TenantId_KeyHash",
                table: "ApiKeys",
                columns: new[] { "TenantId", "KeyHash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ApiKeys_TenantId_Name",
                table: "ApiKeys",
                columns: new[] { "TenantId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_AprovacoesFaixaSalarial_AprovadorId",
                table: "AprovacoesFaixaSalarial",
                column: "AprovadorId");

            migrationBuilder.CreateIndex(
                name: "IX_AprovacoesFaixaSalarial_FaixaSalarialId",
                table: "AprovacoesFaixaSalarial",
                column: "FaixaSalarialId");

            migrationBuilder.CreateIndex(
                name: "IX_AprovacoesFaixaSalarial_SolicitanteId",
                table: "AprovacoesFaixaSalarial",
                column: "SolicitanteId");

            migrationBuilder.CreateIndex(
                name: "IX_AprovacoesFaixaSalarial_TenantId_Status",
                table: "AprovacoesFaixaSalarial",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Areas_OwnerFuncionarioId",
                table: "Areas",
                column: "OwnerFuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Areas_ParentId",
                table: "Areas",
                column: "ParentId");

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
                name: "IX_AuditEntityChanges_AuditEventId",
                table: "AuditEntityChanges",
                column: "AuditEventId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditEntityChanges_AuditTransactionId",
                table: "AuditEntityChanges",
                column: "AuditTransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditEntityChanges_TenantId_EntityName",
                table: "AuditEntityChanges",
                columns: new[] { "TenantId", "EntityName" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditEntityChanges_TenantId_OccurredAt",
                table: "AuditEntityChanges",
                columns: new[] { "TenantId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditEntityPropertyChanges_AuditEntityChangeId",
                table: "AuditEntityPropertyChanges",
                column: "AuditEntityChangeId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditEvents_AuditTransactionId_Order",
                table: "AuditEvents",
                columns: new[] { "AuditTransactionId", "Order" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditTransactions_Path",
                table: "AuditTransactions",
                column: "Path");

            migrationBuilder.CreateIndex(
                name: "IX_AuditTransactions_StartedAt",
                table: "AuditTransactions",
                column: "StartedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AuditTransactions_StatusCode",
                table: "AuditTransactions",
                column: "StatusCode");

            migrationBuilder.CreateIndex(
                name: "IX_AuditTransactions_TenantId_StartedAt",
                table: "AuditTransactions",
                columns: new[] { "TenantId", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditTransactions_TransactionId",
                table: "AuditTransactions",
                column: "TransactionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuditTransactions_UserId",
                table: "AuditTransactions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AvaliacaoCiclos_CriadoPorId",
                table: "AvaliacaoCiclos",
                column: "CriadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_AvaliacaoCiclos_TenantId_Status",
                table: "AvaliacaoCiclos",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_AvaliacaoPerguntas_CicloId",
                table: "AvaliacaoPerguntas",
                column: "CicloId");

            migrationBuilder.CreateIndex(
                name: "IX_AvaliacaoRespostas_AvaliadorId",
                table: "AvaliacaoRespostas",
                column: "AvaliadorId");

            migrationBuilder.CreateIndex(
                name: "IX_AvaliacaoRespostas_AvaliandoId",
                table: "AvaliacaoRespostas",
                column: "AvaliandoId");

            migrationBuilder.CreateIndex(
                name: "IX_AvaliacaoRespostas_CicloId",
                table: "AvaliacaoRespostas",
                column: "CicloId");

            migrationBuilder.CreateIndex(
                name: "IX_AvaliacaoRespostas_TenantId_CicloId_AvaliandoId",
                table: "AvaliacaoRespostas",
                columns: new[] { "TenantId", "CicloId", "AvaliandoId" });

            migrationBuilder.CreateIndex(
                name: "IX_BatchMatchingRuns_TenantId_CreatedAtUtc",
                table: "BatchMatchingRuns",
                columns: new[] { "TenantId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_BatchMatchingRunVagas_RunId",
                table: "BatchMatchingRunVagas",
                column: "RunId");

            migrationBuilder.CreateIndex(
                name: "IX_CamposPersonalizadosVaga_TenantId_VagaId_Ordem",
                table: "CamposPersonalizadosVaga",
                columns: new[] { "TenantId", "VagaId", "Ordem" });

            migrationBuilder.CreateIndex(
                name: "IX_CamposPersonalizadosVaga_VagaId",
                table: "CamposPersonalizadosVaga",
                column: "VagaId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoAcessibilidades_CandidatoId",
                table: "CandidatoAcessibilidades",
                column: "CandidatoId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoAcessibilidades_TenantId_CandidatoId",
                table: "CandidatoAcessibilidades",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoAgendaBloqueios_CandidatoId",
                table: "CandidatoAgendaBloqueios",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoAgendaBloqueios_TenantId_CandidatoId",
                table: "CandidatoAgendaBloqueios",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoAgendaPreferencias_CandidatoId",
                table: "CandidatoAgendaPreferencias",
                column: "CandidatoId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoAgendaPreferencias_TenantId_CandidatoId",
                table: "CandidatoAgendaPreferencias",
                columns: new[] { "TenantId", "CandidatoId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoCertificacoes_CandidatoId",
                table: "CandidatoCertificacoes",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoCertificacoes_TenantId_CandidatoId",
                table: "CandidatoCertificacoes",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoCompetencias_CandidatoId",
                table: "CandidatoCompetencias",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoCompetencias_TenantId_CandidatoId",
                table: "CandidatoCompetencias",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoDocumentos_CandidatoId",
                table: "CandidatoDocumentos",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoDocumentos_TenantId_CandidatoId",
                table: "CandidatoDocumentos",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoEducacaoItens_CandidatoId",
                table: "CandidatoEducacaoItens",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoEducacaoItens_TenantId_CandidatoId",
                table: "CandidatoEducacaoItens",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoEducacaoResumos_CandidatoId",
                table: "CandidatoEducacaoResumos",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoEducacaoResumos_TenantId_CandidatoId",
                table: "CandidatoEducacaoResumos",
                columns: new[] { "TenantId", "CandidatoId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoExperiencias_CandidatoId",
                table: "CandidatoExperiencias",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoExperiencias_TenantId_CandidatoId",
                table: "CandidatoExperiencias",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoLgpdConsents_CandidatoId",
                table: "CandidatoLgpdConsents",
                column: "CandidatoId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoLgpdConsents_TenantId_CandidatoId",
                table: "CandidatoLgpdConsents",
                columns: new[] { "TenantId", "CandidatoId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoNotificacaoPreferencias_CandidatoId",
                table: "CandidatoNotificacaoPreferencias",
                column: "CandidatoId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoNotificacaoPreferencias_TenantId_CandidatoId",
                table: "CandidatoNotificacaoPreferencias",
                columns: new[] { "TenantId", "CandidatoId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoPortfolios_CandidatoId",
                table: "CandidatoPortfolios",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoPortfolios_TenantId_CandidatoId",
                table: "CandidatoPortfolios",
                columns: new[] { "TenantId", "CandidatoId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoPreferenciasVaga_CandidatoId",
                table: "CandidatoPreferenciasVaga",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoPreferenciasVaga_TenantId_CandidatoId",
                table: "CandidatoPreferenciasVaga",
                columns: new[] { "TenantId", "CandidatoId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoProjetos_CandidatoId",
                table: "CandidatoProjetos",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoProjetos_TenantId_CandidatoId",
                table: "CandidatoProjetos",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoReferencias_CandidatoId",
                table: "CandidatoReferencias",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoReferencias_TenantId_CandidatoId",
                table: "CandidatoReferencias",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_Candidatos_TalentoId",
                table: "Candidatos",
                column: "TalentoId");

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
                name: "IX_CandidatoStatusHistories_CandidatoId",
                table: "CandidatoStatusHistories",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoStatusHistories_TenantId_CandidatoId",
                table: "CandidatoStatusHistories",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoStatusHistories_TenantId_CandidatoId_CreatedAtUtc",
                table: "CandidatoStatusHistories",
                columns: new[] { "TenantId", "CandidatoId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoVagaMatchingScores_VagaId_Score",
                table: "CandidatoVagaMatchingScores",
                columns: new[] { "VagaId", "Score" });

            migrationBuilder.CreateIndex(
                name: "IX_Cargos_IsActive",
                table: "Cargos",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Cargos_TenantId_Code",
                table: "Cargos",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CategoriasSalariais_EmpresaId",
                table: "CategoriasSalariais",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_CategoriasSalariais_EstabelecimentoId",
                table: "CategoriasSalariais",
                column: "EstabelecimentoId");

            migrationBuilder.CreateIndex(
                name: "IX_CategoriasSalariais_IsActive",
                table: "CategoriasSalariais",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_CategoriasSalariais_TenantId_EmpresaId_EstabelecimentoId_Co~",
                table: "CategoriasSalariais",
                columns: new[] { "TenantId", "EmpresaId", "EstabelecimentoId", "Code" },
                unique: true,
                filter: "\"EmpresaId\" IS NOT NULL AND \"EstabelecimentoId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CelebrationCommentMentions_CommentId",
                table: "CelebrationCommentMentions",
                column: "CommentId");

            migrationBuilder.CreateIndex(
                name: "IX_CelebrationCommentMentions_CommentId_UserId",
                table: "CelebrationCommentMentions",
                columns: new[] { "CommentId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CelebrationCommentMentions_UserId",
                table: "CelebrationCommentMentions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_CelebrationCommentReactions_CommentId",
                table: "CelebrationCommentReactions",
                column: "CommentId");

            migrationBuilder.CreateIndex(
                name: "IX_CelebrationCommentReactions_CommentId_Type",
                table: "CelebrationCommentReactions",
                columns: new[] { "CommentId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_CelebrationCommentReactions_CommentId_UserId_Type",
                table: "CelebrationCommentReactions",
                columns: new[] { "CommentId", "UserId", "Type" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CelebrationCommentReactions_UserId",
                table: "CelebrationCommentReactions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_CelebrationComments_AuthorId",
                table: "CelebrationComments",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_CelebrationComments_PostId",
                table: "CelebrationComments",
                column: "PostId");

            migrationBuilder.CreateIndex(
                name: "IX_CelebrationComments_TenantId_PostId_CreatedAtUtc",
                table: "CelebrationComments",
                columns: new[] { "TenantId", "PostId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CelebrationMentions_PostId",
                table: "CelebrationMentions",
                column: "PostId");

            migrationBuilder.CreateIndex(
                name: "IX_CelebrationMentions_UserId",
                table: "CelebrationMentions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_CelebrationPosts_AuthorId",
                table: "CelebrationPosts",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_CelebrationPosts_TenantId_CreatedAtUtc",
                table: "CelebrationPosts",
                columns: new[] { "TenantId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CentrosCusto_EmpresaId",
                table: "CentrosCusto",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_CentrosCusto_IsActive",
                table: "CentrosCusto",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_CentrosCusto_TenantId_EmpresaId_Code",
                table: "CentrosCusto",
                columns: new[] { "TenantId", "EmpresaId", "Code" },
                unique: true,
                filter: "\"EmpresaId\" IS NOT NULL");

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
                name: "IX_Dependentes_FuncionarioId",
                table: "Dependentes",
                column: "FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Dependentes_TenantId_FuncionarioId",
                table: "Dependentes",
                columns: new[] { "TenantId", "FuncionarioId" });

            migrationBuilder.CreateIndex(
                name: "IX_DevelopmentPlanGoals_PlanId",
                table: "DevelopmentPlanGoals",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_DevelopmentPlans_OwnerUserId",
                table: "DevelopmentPlans",
                column: "OwnerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DevelopmentPlans_TargetUserId",
                table: "DevelopmentPlans",
                column: "TargetUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DevelopmentPlans_TenantId_OwnerUserId",
                table: "DevelopmentPlans",
                columns: new[] { "TenantId", "OwnerUserId" });

            migrationBuilder.CreateIndex(
                name: "IX_DevelopmentPlans_TenantId_TargetUserId",
                table: "DevelopmentPlans",
                columns: new[] { "TenantId", "TargetUserId" });

            migrationBuilder.CreateIndex(
                name: "IX_DocumentosColaborador_FuncionarioId",
                table: "DocumentosColaborador",
                column: "FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentosColaborador_TenantId_FuncionarioId",
                table: "DocumentosColaborador",
                columns: new[] { "TenantId", "FuncionarioId" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailAttempts_EmailMessageId",
                table: "EmailAttempts",
                column: "EmailMessageId");

            migrationBuilder.CreateIndex(
                name: "IX_EmailAttempts_TenantId_EmailMessageId",
                table: "EmailAttempts",
                columns: new[] { "TenantId", "EmailMessageId" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailAttempts_TenantId_StartedAtUtc",
                table: "EmailAttempts",
                columns: new[] { "TenantId", "StartedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailConfigs_TenantId",
                table: "EmailConfigs",
                column: "TenantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmailMessages_TenantId_CreatedAtUtc",
                table: "EmailMessages",
                columns: new[] { "TenantId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailMessages_TenantId_IsSystem",
                table: "EmailMessages",
                columns: new[] { "TenantId", "IsSystem" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailMessages_TenantId_OwnerUserId",
                table: "EmailMessages",
                columns: new[] { "TenantId", "OwnerUserId" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailMessages_TenantId_Status",
                table: "EmailMessages",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailTemplates_TenantId_Name_IsActive",
                table: "EmailTemplates",
                columns: new[] { "TenantId", "Name", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailTemplates_TenantId_Name_Version",
                table: "EmailTemplates",
                columns: new[] { "TenantId", "Name", "Version" });

            migrationBuilder.CreateIndex(
                name: "IX_Empresas_TenantId_Code",
                table: "Empresas",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EntraIdConfigs_TenantId",
                table: "EntraIdConfigs",
                column: "TenantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionLogs_TenantId_DeviceId_OccurredAt",
                table: "ExceptionLogs",
                columns: new[] { "TenantId", "DeviceId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionLogs_TenantId_EnvironmentNormalized_OccurredAt",
                table: "ExceptionLogs",
                columns: new[] { "TenantId", "EnvironmentNormalized", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionLogs_TenantId_ExceptionType",
                table: "ExceptionLogs",
                columns: new[] { "TenantId", "ExceptionType" });

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionLogs_TenantId_OccurredAt",
                table: "ExceptionLogs",
                columns: new[] { "TenantId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionLogs_TenantId_StatusCode",
                table: "ExceptionLogs",
                columns: new[] { "TenantId", "StatusCode" });

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionLogs_TenantId_TransactionId",
                table: "ExceptionLogs",
                columns: new[] { "TenantId", "TransactionId" });

            migrationBuilder.CreateIndex(
                name: "IX_FaixasSalariais_JobPositionId",
                table: "FaixasSalariais",
                column: "JobPositionId");

            migrationBuilder.CreateIndex(
                name: "IX_FaixasSalariais_TenantId_JobPositionId_EstabelecimentoCodigo",
                table: "FaixasSalariais",
                columns: new[] { "TenantId", "JobPositionId", "EstabelecimentoCodigo" });

            migrationBuilder.CreateIndex(
                name: "IX_FasesProcesso_ProjetoId",
                table: "FasesProcesso",
                column: "ProjetoId");

            migrationBuilder.CreateIndex(
                name: "IX_FasesProcesso_TenantId_ProjetoId_Ordem",
                table: "FasesProcesso",
                columns: new[] { "TenantId", "ProjetoId", "Ordem" });

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackItemRatings_FeedbackItemId",
                table: "FeedbackItemRatings",
                column: "FeedbackItemId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackItems_FromUserId",
                table: "FeedbackItems",
                column: "FromUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackItems_TenantId_CreatedAtUtc",
                table: "FeedbackItems",
                columns: new[] { "TenantId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackItems_TenantId_FromUserId",
                table: "FeedbackItems",
                columns: new[] { "TenantId", "FromUserId" });

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackItems_TenantId_ToUserId",
                table: "FeedbackItems",
                columns: new[] { "TenantId", "ToUserId" });

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackItems_ToUserId",
                table: "FeedbackItems",
                column: "ToUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_AreaId",
                table: "Funcionarios",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_GestorDiretoId",
                table: "Funcionarios",
                column: "GestorDiretoId");

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_JobPositionId",
                table: "Funcionarios",
                column: "JobPositionId");

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_NivelHierarquicoId",
                table: "Funcionarios",
                column: "NivelHierarquicoId");

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_PessoaId",
                table: "Funcionarios",
                column: "PessoaId");

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_RequisitoCategoriaId",
                table: "Funcionarios",
                column: "RequisitoCategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_TenantId_CdnEmpresa_CdnEstab_CdnFuncionario",
                table: "Funcionarios",
                columns: new[] { "TenantId", "CdnEmpresa", "CdnEstab", "CdnFuncionario" },
                unique: true,
                filter: "\"CdnFuncionario\" IS NOT NULL");

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

            migrationBuilder.CreateIndex(
                name: "IX_GamificationDailyStates_TenantId_LastCheckInDate",
                table: "GamificationDailyStates",
                columns: new[] { "TenantId", "LastCheckInDate" });

            migrationBuilder.CreateIndex(
                name: "IX_GamificationDailyStates_TenantId_UserId",
                table: "GamificationDailyStates",
                columns: new[] { "TenantId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GamificationDailyStates_UserId",
                table: "GamificationDailyStates",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_InboxAttachments_InboxItemId",
                table: "InboxAttachments",
                column: "InboxItemId");

            migrationBuilder.CreateIndex(
                name: "IX_InboxAttachments_TenantId_InboxItemId",
                table: "InboxAttachments",
                columns: new[] { "TenantId", "InboxItemId" });

            migrationBuilder.CreateIndex(
                name: "IX_InboxItems_CandidatoId",
                table: "InboxItems",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_InboxItems_TenantId_Origem",
                table: "InboxItems",
                columns: new[] { "TenantId", "Origem" });

            migrationBuilder.CreateIndex(
                name: "IX_InboxItems_TenantId_RecebidoEm",
                table: "InboxItems",
                columns: new[] { "TenantId", "RecebidoEm" });

            migrationBuilder.CreateIndex(
                name: "IX_InboxItems_TenantId_Status",
                table: "InboxItems",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_InboxItems_VagaId",
                table: "InboxItems",
                column: "VagaId");

            migrationBuilder.CreateIndex(
                name: "IX_JobPositions_AreaId",
                table: "JobPositions",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_JobPositions_NivelCargoId",
                table: "JobPositions",
                column: "NivelCargoId");

            migrationBuilder.CreateIndex(
                name: "IX_JobPositions_NivelHierarquicoId",
                table: "JobPositions",
                column: "NivelHierarquicoId");

            migrationBuilder.CreateIndex(
                name: "IX_JobPositions_TenantId_Code",
                table: "JobPositions",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LocalizationConfigs_TenantId",
                table: "LocalizationConfigs",
                column: "TenantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LogEntries_RequestLogId_Order",
                table: "LogEntries",
                columns: new[] { "RequestLogId", "Order" });

            migrationBuilder.CreateIndex(
                name: "IX_LogEntries_TenantId_Category",
                table: "LogEntries",
                columns: new[] { "TenantId", "Category" });

            migrationBuilder.CreateIndex(
                name: "IX_LogEntries_TenantId_DeviceId_OccurredAt",
                table: "LogEntries",
                columns: new[] { "TenantId", "DeviceId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_LogEntries_TenantId_EnvironmentNormalized_OccurredAt",
                table: "LogEntries",
                columns: new[] { "TenantId", "EnvironmentNormalized", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_LogEntries_TenantId_Level",
                table: "LogEntries",
                columns: new[] { "TenantId", "Level" });

            migrationBuilder.CreateIndex(
                name: "IX_LogEntries_TenantId_OccurredAt",
                table: "LogEntries",
                columns: new[] { "TenantId", "OccurredAt" });

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
                name: "IX_Menus_TenantId_PermissionKey",
                table: "Menus",
                columns: new[] { "TenantId", "PermissionKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Menus_TenantId_Route",
                table: "Menus",
                columns: new[] { "TenantId", "Route" });

            migrationBuilder.CreateIndex(
                name: "IX_Metas_CriadaPorId",
                table: "Metas",
                column: "CriadaPorId");

            migrationBuilder.CreateIndex(
                name: "IX_Metas_FuncionarioId",
                table: "Metas",
                column: "FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Metas_TenantId_FuncionarioId",
                table: "Metas",
                columns: new[] { "TenantId", "FuncionarioId" });

            migrationBuilder.CreateIndex(
                name: "IX_Metas_TenantId_Status",
                table: "Metas",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_MoodEntries_TenantId_UserId_CreatedAtUtc",
                table: "MoodEntries",
                columns: new[] { "TenantId", "UserId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_MoodEntries_UserId",
                table: "MoodEntries",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_NineBoxAssessments_AvaliadorId",
                table: "NineBoxAssessments",
                column: "AvaliadorId");

            migrationBuilder.CreateIndex(
                name: "IX_NineBoxAssessments_FuncionarioId",
                table: "NineBoxAssessments",
                column: "FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_NineBoxAssessments_TenantId_CriadoEmUtc",
                table: "NineBoxAssessments",
                columns: new[] { "TenantId", "CriadoEmUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_NineBoxAssessments_TenantId_FuncionarioId",
                table: "NineBoxAssessments",
                columns: new[] { "TenantId", "FuncionarioId" });

            migrationBuilder.CreateIndex(
                name: "IX_NiveisHierarquicos_TenantId_Ordem",
                table: "NiveisHierarquicos",
                columns: new[] { "TenantId", "Ordem" });

            migrationBuilder.CreateIndex(
                name: "IX_NotificationReceipts_TenantId_NotificationId",
                table: "NotificationReceipts",
                columns: new[] { "TenantId", "NotificationId" });

            migrationBuilder.CreateIndex(
                name: "IX_NotificationReceipts_TenantId_NotificationId_UserId",
                table: "NotificationReceipts",
                columns: new[] { "TenantId", "NotificationId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NotificationReceipts_TenantId_UserId",
                table: "NotificationReceipts",
                columns: new[] { "TenantId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_TenantId_CreatedAtUtc",
                table: "Notifications",
                columns: new[] { "TenantId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_TenantId_IsRead",
                table: "Notifications",
                columns: new[] { "TenantId", "IsRead" });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_TenantId_UserId_CreatedAtUtc",
                table: "Notifications",
                columns: new[] { "TenantId", "UserId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId",
                table: "Notifications",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_OneOnOneMeetings_CollaboratorId",
                table: "OneOnOneMeetings",
                column: "CollaboratorId");

            migrationBuilder.CreateIndex(
                name: "IX_OneOnOneMeetings_ManagerId",
                table: "OneOnOneMeetings",
                column: "ManagerId");

            migrationBuilder.CreateIndex(
                name: "IX_OneOnOneMeetings_TenantId_CollaboratorId",
                table: "OneOnOneMeetings",
                columns: new[] { "TenantId", "CollaboratorId" });

            migrationBuilder.CreateIndex(
                name: "IX_OneOnOneMeetings_TenantId_ManagerId",
                table: "OneOnOneMeetings",
                columns: new[] { "TenantId", "ManagerId" });

            migrationBuilder.CreateIndex(
                name: "IX_OneOnOneMeetings_TenantId_MeetingDate",
                table: "OneOnOneMeetings",
                columns: new[] { "TenantId", "MeetingDate" });

            migrationBuilder.CreateIndex(
                name: "IX_PermissoesNivelVaga_NivelHierarquicoId",
                table: "PermissoesNivelVaga",
                column: "NivelHierarquicoId");

            migrationBuilder.CreateIndex(
                name: "IX_PermissoesNivelVaga_RoleId",
                table: "PermissoesNivelVaga",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_PermissoesNivelVaga_TenantId_NivelHierarquicoId_RoleId",
                table: "PermissoesNivelVaga",
                columns: new[] { "TenantId", "NivelHierarquicoId", "RoleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PessoaBloqueios_PessoaId",
                table: "PessoaBloqueios",
                column: "PessoaId");

            migrationBuilder.CreateIndex(
                name: "IX_PessoaBloqueios_TenantId_PessoaId",
                table: "PessoaBloqueios",
                columns: new[] { "TenantId", "PessoaId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pessoas_TenantId_Email",
                table: "Pessoas",
                columns: new[] { "TenantId", "Email" });

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissaoDocumentos_PreAdmissaoId",
                table: "PreAdmissaoDocumentos",
                column: "PreAdmissaoId");

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissaoDocumentos_TenantId_PreAdmissaoId",
                table: "PreAdmissaoDocumentos",
                columns: new[] { "TenantId", "PreAdmissaoId" });

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissaoDocumentosSolicitados_PreAdmissaoId",
                table: "PreAdmissaoDocumentosSolicitados",
                column: "PreAdmissaoId");

            migrationBuilder.CreateIndex(
                name: "IX_PreAdmissaoDocumentosSolicitados_TenantId_PreAdmissaoId",
                table: "PreAdmissaoDocumentosSolicitados",
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
                name: "IX_PreAdmissoes_TenantId_AccessToken",
                table: "PreAdmissoes",
                columns: new[] { "TenantId", "AccessToken" },
                filter: "\"AccessToken\" IS NOT NULL");

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

            migrationBuilder.CreateIndex(
                name: "IX_RecruiterMatchingFeedbacks_TenantId_VagaId",
                table: "RecruiterMatchingFeedbacks",
                columns: new[] { "TenantId", "VagaId" });

            migrationBuilder.CreateIndex(
                name: "IX_RecruiterMatchingFeedbacks_VagaId_CandidatoId",
                table: "RecruiterMatchingFeedbacks",
                columns: new[] { "VagaId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_RegrasAprovacaoVaga_Aprovador1FuncionarioId",
                table: "RegrasAprovacaoVaga",
                column: "Aprovador1FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_RegrasAprovacaoVaga_Aprovador2FuncionarioId",
                table: "RegrasAprovacaoVaga",
                column: "Aprovador2FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_RegrasAprovacaoVaga_SolicitanteRoleId",
                table: "RegrasAprovacaoVaga",
                column: "SolicitanteRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_RegrasAprovacaoVaga_TenantId_SolicitanteRoleId",
                table: "RegrasAprovacaoVaga",
                columns: new[] { "TenantId", "SolicitanteRoleId" });

            migrationBuilder.CreateIndex(
                name: "IX_RenderCoinBalances_TenantId_Balance",
                table: "RenderCoinBalances",
                columns: new[] { "TenantId", "Balance" });

            migrationBuilder.CreateIndex(
                name: "IX_RenderCoinBalances_UserId",
                table: "RenderCoinBalances",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_RenderCoinTransactions_TenantId_CreatedAtUtc",
                table: "RenderCoinTransactions",
                columns: new[] { "TenantId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_RenderCoinTransactions_TenantId_UserId",
                table: "RenderCoinTransactions",
                columns: new[] { "TenantId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_RenderCoinTransactions_TenantId_UserId_SourceType_SourceId",
                table: "RenderCoinTransactions",
                columns: new[] { "TenantId", "UserId", "SourceType", "SourceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RenderCoinTransactions_UserId",
                table: "RenderCoinTransactions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_RequestLogs_TenantId_DeviceId_StartedAt",
                table: "RequestLogs",
                columns: new[] { "TenantId", "DeviceId", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_RequestLogs_TenantId_EnvironmentNormalized_StartedAt",
                table: "RequestLogs",
                columns: new[] { "TenantId", "EnvironmentNormalized", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_RequestLogs_TenantId_Path",
                table: "RequestLogs",
                columns: new[] { "TenantId", "Path" });

            migrationBuilder.CreateIndex(
                name: "IX_RequestLogs_TenantId_StartedAt",
                table: "RequestLogs",
                columns: new[] { "TenantId", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_RequestLogs_TenantId_StatusCode",
                table: "RequestLogs",
                columns: new[] { "TenantId", "StatusCode" });

            migrationBuilder.CreateIndex(
                name: "IX_RequestLogs_TenantId_TransactionId",
                table: "RequestLogs",
                columns: new[] { "TenantId", "TransactionId" });

            migrationBuilder.CreateIndex(
                name: "IX_RequestLogs_TenantId_UserId",
                table: "RequestLogs",
                columns: new[] { "TenantId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_RequisitoCategorias_TenantId_Code",
                table: "RequisitoCategorias",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RespostasCampoPersonalizadoVaga_CampoId",
                table: "RespostasCampoPersonalizadoVaga",
                column: "CampoId");

            migrationBuilder.CreateIndex(
                name: "IX_RespostasCampoPersonalizadoVaga_CandidatoId",
                table: "RespostasCampoPersonalizadoVaga",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_RespostasCampoPersonalizadoVaga_TenantId_VagaId_CandidatoId",
                table: "RespostasCampoPersonalizadoVaga",
                columns: new[] { "TenantId", "VagaId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_RespostasCampoPersonalizadoVaga_VagaId",
                table: "RespostasCampoPersonalizadoVaga",
                column: "VagaId");

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
                name: "IX_SolicitacoesPagamentoExtra_Aprovador1Id",
                table: "SolicitacoesPagamentoExtra",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPagamentoExtra_Aprovador2Id",
                table: "SolicitacoesPagamentoExtra",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPagamentoExtra_FuncionarioId",
                table: "SolicitacoesPagamentoExtra",
                column: "FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPagamentoExtra_SolicitanteId",
                table: "SolicitacoesPagamentoExtra",
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
                name: "IX_SolicitacoesPromocao_CentroCustoId",
                table: "SolicitacoesPromocao",
                column: "CentroCustoId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_EmpresaId",
                table: "SolicitacoesPromocao",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_FuncionarioId",
                table: "SolicitacoesPromocao",
                column: "FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_NovaAreaId",
                table: "SolicitacoesPromocao",
                column: "NovaAreaId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_NovaUnidadeId",
                table: "SolicitacoesPromocao",
                column: "NovaUnidadeId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_NovoCargoId",
                table: "SolicitacoesPromocao",
                column: "NovoCargoId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_SolicitanteId",
                table: "SolicitacoesPromocao",
                column: "SolicitanteId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_UnidadeLotacaoId",
                table: "SolicitacoesPromocao",
                column: "UnidadeLotacaoId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_Aprovador1Id",
                table: "SolicitacoesVaga",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_Aprovador2Id",
                table: "SolicitacoesVaga",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_AprovadorId",
                table: "SolicitacoesVaga",
                column: "AprovadorId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_AreaId",
                table: "SolicitacoesVaga",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_CentroCustoId",
                table: "SolicitacoesVaga",
                column: "CentroCustoId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_EmpresaId",
                table: "SolicitacoesVaga",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_JobPositionId",
                table: "SolicitacoesVaga",
                column: "JobPositionId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_SolicitanteId",
                table: "SolicitacoesVaga",
                column: "SolicitanteId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_SubstituidoFuncionarioId",
                table: "SolicitacoesVaga",
                column: "SubstituidoFuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_TenantId_SolicitanteId",
                table: "SolicitacoesVaga",
                columns: new[] { "TenantId", "SolicitanteId" });

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_TenantId_Status",
                table: "SolicitacoesVaga",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_UnidadeLotacaoId",
                table: "SolicitacoesVaga",
                column: "UnidadeLotacaoId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_UnitId",
                table: "SolicitacoesVaga",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyAnswers_ResponseId",
                table: "SurveyAnswers",
                column: "ResponseId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyAnswers_TenantId_ResponseId",
                table: "SurveyAnswers",
                columns: new[] { "TenantId", "ResponseId" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyOptions_QuestionId",
                table: "SurveyOptions",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyOptions_TenantId_QuestionId",
                table: "SurveyOptions",
                columns: new[] { "TenantId", "QuestionId" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestions_SurveyId",
                table: "SurveyQuestions",
                column: "SurveyId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestions_TenantId_SurveyId",
                table: "SurveyQuestions",
                columns: new[] { "TenantId", "SurveyId" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_SurveyId",
                table: "SurveyResponses",
                column: "SurveyId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_TenantId_SurveyId",
                table: "SurveyResponses",
                columns: new[] { "TenantId", "SurveyId" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_TenantId_SurveyId_UserId",
                table: "SurveyResponses",
                columns: new[] { "TenantId", "SurveyId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_TenantId_UserId",
                table: "SurveyResponses",
                columns: new[] { "TenantId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_Surveys_TenantId_CreatedAtUtc",
                table: "Surveys",
                columns: new[] { "TenantId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_TalentoCompetencias_TalentoId",
                table: "TalentoCompetencias",
                column: "TalentoId");

            migrationBuilder.CreateIndex(
                name: "IX_TalentoCompetencias_TenantId_TalentoId",
                table: "TalentoCompetencias",
                columns: new[] { "TenantId", "TalentoId" });

            migrationBuilder.CreateIndex(
                name: "IX_TalentoCvImportJobs_TalentoDocumentoId",
                table: "TalentoCvImportJobs",
                column: "TalentoDocumentoId");

            migrationBuilder.CreateIndex(
                name: "IX_TalentoCvImportJobs_TalentoId",
                table: "TalentoCvImportJobs",
                column: "TalentoId");

            migrationBuilder.CreateIndex(
                name: "IX_TalentoCvImportJobs_TenantId_Status",
                table: "TalentoCvImportJobs",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_TalentoCvImportJobs_TenantId_TalentoId",
                table: "TalentoCvImportJobs",
                columns: new[] { "TenantId", "TalentoId" });

            migrationBuilder.CreateIndex(
                name: "IX_TalentoDocumentos_TalentoId",
                table: "TalentoDocumentos",
                column: "TalentoId");

            migrationBuilder.CreateIndex(
                name: "IX_TalentoDocumentos_TenantId_TalentoId",
                table: "TalentoDocumentos",
                columns: new[] { "TenantId", "TalentoId" });

            migrationBuilder.CreateIndex(
                name: "IX_TalentoExperiencias_TalentoId",
                table: "TalentoExperiencias",
                column: "TalentoId");

            migrationBuilder.CreateIndex(
                name: "IX_TalentoExperiencias_TenantId_TalentoId",
                table: "TalentoExperiencias",
                columns: new[] { "TenantId", "TalentoId" });

            migrationBuilder.CreateIndex(
                name: "IX_TalentoFormacoes_TalentoId",
                table: "TalentoFormacoes",
                column: "TalentoId");

            migrationBuilder.CreateIndex(
                name: "IX_TalentoFormacoes_TenantId_TalentoId",
                table: "TalentoFormacoes",
                columns: new[] { "TenantId", "TalentoId" });

            migrationBuilder.CreateIndex(
                name: "IX_Talentos_PessoaId",
                table: "Talentos",
                column: "PessoaId");

            migrationBuilder.CreateIndex(
                name: "IX_Talentos_TenantId_PessoaId",
                table: "Talentos",
                columns: new[] { "TenantId", "PessoaId" });

            migrationBuilder.CreateIndex(
                name: "IX_TalentoTreinamentos_TalentoId",
                table: "TalentoTreinamentos",
                column: "TalentoId");

            migrationBuilder.CreateIndex(
                name: "IX_TalentoTreinamentos_TenantId_TalentoId",
                table: "TalentoTreinamentos",
                columns: new[] { "TenantId", "TalentoId" });

            migrationBuilder.CreateIndex(
                name: "IX_Turnos_IsActive",
                table: "Turnos",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Turnos_TenantId_Code",
                table: "Turnos",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UnidadesLotacao_IsActive",
                table: "UnidadesLotacao",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_UnidadesLotacao_OwnerFuncionarioId",
                table: "UnidadesLotacao",
                column: "OwnerFuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_UnidadesLotacao_ParentId",
                table: "UnidadesLotacao",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_UnidadesLotacao_TenantId_Code",
                table: "UnidadesLotacao",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Units_EmpresaId",
                table: "Units",
                column: "EmpresaId");

            migrationBuilder.CreateIndex(
                name: "IX_Units_TenantId_EmpresaId_Code",
                table: "Units",
                columns: new[] { "TenantId", "EmpresaId", "Code" },
                unique: true,
                filter: "\"EmpresaId\" IS NOT NULL");

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
                name: "IX_Users_FuncionarioId",
                table: "Users",
                column: "FuncionarioId");

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
                name: "IX_UserUnits_UnitId",
                table: "UserUnits",
                column: "UnitId");

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
                name: "IX_Vagas_CategoriaSalarialId",
                table: "Vagas",
                column: "CategoriaSalarialId");

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_CentroCustoId",
                table: "Vagas",
                column: "CentroCustoId");

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_DepartmentId",
                table: "Vagas",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_JobPositionId",
                table: "Vagas",
                column: "JobPositionId");

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_RecrutadorResponsavelUserId",
                table: "Vagas",
                column: "RecrutadorResponsavelUserId");

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

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_TurnoId",
                table: "Vagas",
                column: "TurnoId");

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_UnidadeLotacaoId",
                table: "Vagas",
                column: "UnidadeLotacaoId");

            migrationBuilder.CreateIndex(
                name: "IX_VagaUnifiedMatchingCaches_TenantId_Status",
                table: "VagaUnifiedMatchingCaches",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_VagaUnifiedMatchingCaches_TenantId_VagaId",
                table: "VagaUnifiedMatchingCaches",
                columns: new[] { "TenantId", "VagaId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_AprovacoesFaixaSalarial_FaixasSalariais_FaixaSalarialId",
                table: "AprovacoesFaixaSalarial",
                column: "FaixaSalarialId",
                principalTable: "FaixasSalariais",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AprovacoesFaixaSalarial_Funcionarios_AprovadorId",
                table: "AprovacoesFaixaSalarial",
                column: "AprovadorId",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_AprovacoesFaixaSalarial_Funcionarios_SolicitanteId",
                table: "AprovacoesFaixaSalarial",
                column: "SolicitanteId",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Areas_Funcionarios_OwnerFuncionarioId",
                table: "Areas",
                column: "OwnerFuncionarioId",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUserClaims_Users_UserId",
                table: "AspNetUserClaims",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUserLogins_Users_UserId",
                table: "AspNetUserLogins",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUserTokens_Users_UserId",
                table: "AspNetUserTokens",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AvaliacaoCiclos_Funcionarios_CriadoPorId",
                table: "AvaliacaoCiclos",
                column: "CriadoPorId",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_AvaliacaoRespostas_Funcionarios_AvaliadorId",
                table: "AvaliacaoRespostas",
                column: "AvaliadorId",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_AvaliacaoRespostas_Funcionarios_AvaliandoId",
                table: "AvaliacaoRespostas",
                column: "AvaliandoId",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CamposPersonalizadosVaga_Vagas_VagaId",
                table: "CamposPersonalizadosVaga",
                column: "VagaId",
                principalTable: "Vagas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoAcessibilidades_Candidatos_CandidatoId",
                table: "CandidatoAcessibilidades",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoAgendaBloqueios_Candidatos_CandidatoId",
                table: "CandidatoAgendaBloqueios",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoAgendaPreferencias_Candidatos_CandidatoId",
                table: "CandidatoAgendaPreferencias",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoCertificacoes_Candidatos_CandidatoId",
                table: "CandidatoCertificacoes",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoCompetencias_Candidatos_CandidatoId",
                table: "CandidatoCompetencias",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoDocumentos_Candidatos_CandidatoId",
                table: "CandidatoDocumentos",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoEducacaoItens_Candidatos_CandidatoId",
                table: "CandidatoEducacaoItens",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoEducacaoResumos_Candidatos_CandidatoId",
                table: "CandidatoEducacaoResumos",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoExperiencias_Candidatos_CandidatoId",
                table: "CandidatoExperiencias",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoLgpdConsents_Candidatos_CandidatoId",
                table: "CandidatoLgpdConsents",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoNotificacaoPreferencias_Candidatos_CandidatoId",
                table: "CandidatoNotificacaoPreferencias",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoPortfolios_Candidatos_CandidatoId",
                table: "CandidatoPortfolios",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoPreferenciasVaga_Candidatos_CandidatoId",
                table: "CandidatoPreferenciasVaga",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoProjetos_Candidatos_CandidatoId",
                table: "CandidatoProjetos",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoReferencias_Candidatos_CandidatoId",
                table: "CandidatoReferencias",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Candidatos_Vagas_VagaId",
                table: "Candidatos",
                column: "VagaId",
                principalTable: "Vagas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CandidatoVagaMatchingScores_Vagas_VagaId",
                table: "CandidatoVagaMatchingScores",
                column: "VagaId",
                principalTable: "Vagas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CelebrationCommentMentions_CelebrationComments_CommentId",
                table: "CelebrationCommentMentions",
                column: "CommentId",
                principalTable: "CelebrationComments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CelebrationCommentMentions_Users_UserId",
                table: "CelebrationCommentMentions",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CelebrationCommentReactions_CelebrationComments_CommentId",
                table: "CelebrationCommentReactions",
                column: "CommentId",
                principalTable: "CelebrationComments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CelebrationCommentReactions_Users_UserId",
                table: "CelebrationCommentReactions",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CelebrationComments_CelebrationPosts_PostId",
                table: "CelebrationComments",
                column: "PostId",
                principalTable: "CelebrationPosts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CelebrationComments_Users_AuthorId",
                table: "CelebrationComments",
                column: "AuthorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CelebrationMentions_CelebrationPosts_PostId",
                table: "CelebrationMentions",
                column: "PostId",
                principalTable: "CelebrationPosts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CelebrationMentions_Users_UserId",
                table: "CelebrationMentions",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CelebrationPosts_Users_AuthorId",
                table: "CelebrationPosts",
                column: "AuthorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Dependentes_Funcionarios_FuncionarioId",
                table: "Dependentes",
                column: "FuncionarioId",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_DevelopmentPlanGoals_DevelopmentPlans_PlanId",
                table: "DevelopmentPlanGoals",
                column: "PlanId",
                principalTable: "DevelopmentPlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_DevelopmentPlans_Users_OwnerUserId",
                table: "DevelopmentPlans",
                column: "OwnerUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DevelopmentPlans_Users_TargetUserId",
                table: "DevelopmentPlans",
                column: "TargetUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_DocumentosColaborador_Funcionarios_FuncionarioId",
                table: "DocumentosColaborador",
                column: "FuncionarioId",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_FasesProcesso_ProjetosVaga_ProjetoId",
                table: "FasesProcesso",
                column: "ProjetoId",
                principalTable: "ProjetosVaga",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_FeedbackItemRatings_FeedbackItems_FeedbackItemId",
                table: "FeedbackItemRatings",
                column: "FeedbackItemId",
                principalTable: "FeedbackItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_FeedbackItems_Users_FromUserId",
                table: "FeedbackItems",
                column: "FromUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_FeedbackItems_Users_ToUserId",
                table: "FeedbackItems",
                column: "ToUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Funcionarios_Users_UserId",
                table: "Funcionarios",
                column: "UserId",
                principalTable: "Users",
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
                name: "AgendaEvents");

            migrationBuilder.DropTable(
                name: "ApiKeys");

            migrationBuilder.DropTable(
                name: "AprovacoesFaixaSalarial");

            migrationBuilder.DropTable(
                name: "AspNetRoleClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserLogins");

            migrationBuilder.DropTable(
                name: "AspNetUserTokens");

            migrationBuilder.DropTable(
                name: "AuditEntityPropertyChanges");

            migrationBuilder.DropTable(
                name: "AvaliacaoPerguntas");

            migrationBuilder.DropTable(
                name: "AvaliacaoRespostas");

            migrationBuilder.DropTable(
                name: "BatchMatchingRunVagas");

            migrationBuilder.DropTable(
                name: "CandidatoAcessibilidades");

            migrationBuilder.DropTable(
                name: "CandidatoAgendaBloqueios");

            migrationBuilder.DropTable(
                name: "CandidatoAgendaPreferencias");

            migrationBuilder.DropTable(
                name: "CandidatoCertificacoes");

            migrationBuilder.DropTable(
                name: "CandidatoCompetencias");

            migrationBuilder.DropTable(
                name: "CandidatoDocumentos");

            migrationBuilder.DropTable(
                name: "CandidatoEducacaoItens");

            migrationBuilder.DropTable(
                name: "CandidatoEducacaoResumos");

            migrationBuilder.DropTable(
                name: "CandidatoExperiencias");

            migrationBuilder.DropTable(
                name: "CandidatoLgpdConsents");

            migrationBuilder.DropTable(
                name: "CandidatoNotificacaoPreferencias");

            migrationBuilder.DropTable(
                name: "CandidatoPortfolios");

            migrationBuilder.DropTable(
                name: "CandidatoPreferenciasVaga");

            migrationBuilder.DropTable(
                name: "CandidatoProjetos");

            migrationBuilder.DropTable(
                name: "CandidatoReferencias");

            migrationBuilder.DropTable(
                name: "CandidatoStatusHistories");

            migrationBuilder.DropTable(
                name: "CandidatoVagaMatchingScores");

            migrationBuilder.DropTable(
                name: "Cargos");

            migrationBuilder.DropTable(
                name: "CelebrationCommentMentions");

            migrationBuilder.DropTable(
                name: "CelebrationCommentReactions");

            migrationBuilder.DropTable(
                name: "CelebrationMentions");

            migrationBuilder.DropTable(
                name: "DevelopmentPlanGoals");

            migrationBuilder.DropTable(
                name: "DocumentosColaborador");

            migrationBuilder.DropTable(
                name: "EmailAttempts");

            migrationBuilder.DropTable(
                name: "EmailConfigs");

            migrationBuilder.DropTable(
                name: "EmailTemplates");

            migrationBuilder.DropTable(
                name: "EntraIdConfigs");

            migrationBuilder.DropTable(
                name: "ExceptionLogs");

            migrationBuilder.DropTable(
                name: "FeedbackItemRatings");

            migrationBuilder.DropTable(
                name: "GamificationDailyStates");

            migrationBuilder.DropTable(
                name: "InboxAttachments");

            migrationBuilder.DropTable(
                name: "LocalizationConfigs");

            migrationBuilder.DropTable(
                name: "LogEntries");

            migrationBuilder.DropTable(
                name: "LogsComunicacao");

            migrationBuilder.DropTable(
                name: "Metas");

            migrationBuilder.DropTable(
                name: "MoodEntries");

            migrationBuilder.DropTable(
                name: "NineBoxAssessments");

            migrationBuilder.DropTable(
                name: "NotificationReceipts");

            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropTable(
                name: "OneOnOneMeetings");

            migrationBuilder.DropTable(
                name: "PermissoesNivelVaga");

            migrationBuilder.DropTable(
                name: "PessoaBloqueios");

            migrationBuilder.DropTable(
                name: "PreAdmissaoDocumentos");

            migrationBuilder.DropTable(
                name: "PreAdmissaoDocumentosSolicitados");

            migrationBuilder.DropTable(
                name: "ProjetoCandidatos");

            migrationBuilder.DropTable(
                name: "RecruiterMatchingFeedbacks");

            migrationBuilder.DropTable(
                name: "RegrasAprovacaoVaga");

            migrationBuilder.DropTable(
                name: "RenderCoinBalances");

            migrationBuilder.DropTable(
                name: "RenderCoinTransactions");

            migrationBuilder.DropTable(
                name: "RequestLogs");

            migrationBuilder.DropTable(
                name: "RespostasCampoPersonalizadoVaga");

            migrationBuilder.DropTable(
                name: "RoleMenus");

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
                name: "SolicitacoesPagamentoExtra");

            migrationBuilder.DropTable(
                name: "SolicitacoesPromocao");

            migrationBuilder.DropTable(
                name: "SolicitacoesVaga");

            migrationBuilder.DropTable(
                name: "SurveyAnswers");

            migrationBuilder.DropTable(
                name: "SurveyOptions");

            migrationBuilder.DropTable(
                name: "TalentoCompetencias");

            migrationBuilder.DropTable(
                name: "TalentoCvImportJobs");

            migrationBuilder.DropTable(
                name: "TalentoExperiencias");

            migrationBuilder.DropTable(
                name: "TalentoFormacoes");

            migrationBuilder.DropTable(
                name: "TalentoTreinamentos");

            migrationBuilder.DropTable(
                name: "TenantAwsSettings");

            migrationBuilder.DropTable(
                name: "UserRoles");

            migrationBuilder.DropTable(
                name: "UserUnits");

            migrationBuilder.DropTable(
                name: "VagaBeneficios");

            migrationBuilder.DropTable(
                name: "VagaEtapas");

            migrationBuilder.DropTable(
                name: "VagaPerguntas");

            migrationBuilder.DropTable(
                name: "VagaRequisitos");

            migrationBuilder.DropTable(
                name: "VagaUnifiedMatchingCaches");

            migrationBuilder.DropTable(
                name: "AgendaEventTypes");

            migrationBuilder.DropTable(
                name: "FaixasSalariais");

            migrationBuilder.DropTable(
                name: "AuditEntityChanges");

            migrationBuilder.DropTable(
                name: "AvaliacaoCiclos");

            migrationBuilder.DropTable(
                name: "BatchMatchingRuns");

            migrationBuilder.DropTable(
                name: "CelebrationComments");

            migrationBuilder.DropTable(
                name: "DevelopmentPlans");

            migrationBuilder.DropTable(
                name: "EmailMessages");

            migrationBuilder.DropTable(
                name: "FeedbackItems");

            migrationBuilder.DropTable(
                name: "InboxItems");

            migrationBuilder.DropTable(
                name: "PreAdmissoes");

            migrationBuilder.DropTable(
                name: "FasesProcesso");

            migrationBuilder.DropTable(
                name: "CamposPersonalizadosVaga");

            migrationBuilder.DropTable(
                name: "Menus");

            migrationBuilder.DropTable(
                name: "Skills");

            migrationBuilder.DropTable(
                name: "Dependentes");

            migrationBuilder.DropTable(
                name: "SurveyResponses");

            migrationBuilder.DropTable(
                name: "SurveyQuestions");

            migrationBuilder.DropTable(
                name: "TalentoDocumentos");

            migrationBuilder.DropTable(
                name: "Roles");

            migrationBuilder.DropTable(
                name: "AuditEvents");

            migrationBuilder.DropTable(
                name: "CelebrationPosts");

            migrationBuilder.DropTable(
                name: "Candidatos");

            migrationBuilder.DropTable(
                name: "ProjetosVaga");

            migrationBuilder.DropTable(
                name: "Surveys");

            migrationBuilder.DropTable(
                name: "AuditTransactions");

            migrationBuilder.DropTable(
                name: "Talentos");

            migrationBuilder.DropTable(
                name: "Vagas");

            migrationBuilder.DropTable(
                name: "CategoriasSalariais");

            migrationBuilder.DropTable(
                name: "CentrosCusto");

            migrationBuilder.DropTable(
                name: "Departments");

            migrationBuilder.DropTable(
                name: "Turnos");

            migrationBuilder.DropTable(
                name: "UnidadesLotacao");

            migrationBuilder.DropTable(
                name: "Funcionarios");

            migrationBuilder.DropTable(
                name: "JobPositions");

            migrationBuilder.DropTable(
                name: "Pessoas");

            migrationBuilder.DropTable(
                name: "RequisitoCategorias");

            migrationBuilder.DropTable(
                name: "Units");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Areas");

            migrationBuilder.DropTable(
                name: "NiveisCargo");

            migrationBuilder.DropTable(
                name: "NiveisHierarquicos");

            migrationBuilder.DropTable(
                name: "Empresas");
        }
    }
}
