using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLoggingTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ExceptionLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RequestLogId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    EnvironmentName = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    EnvironmentNormalized = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    DeviceId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    DeviceType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Platform = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Browser = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    DeviceAppVersion = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Locale = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
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
                name: "LogEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RequestLogId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    EnvironmentName = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    EnvironmentNormalized = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    DeviceId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    DeviceType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Platform = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Browser = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    DeviceAppVersion = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Locale = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
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
                name: "RequestLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TransactionId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CorrelationId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    TraceId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    EnvironmentName = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    EnvironmentNormalized = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    DeviceId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    DeviceType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Platform = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Browser = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    DeviceAppVersion = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Locale = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExceptionLogs");

            migrationBuilder.DropTable(
                name: "LogEntries");

            migrationBuilder.DropTable(
                name: "RequestLogs");
        }
    }
}
