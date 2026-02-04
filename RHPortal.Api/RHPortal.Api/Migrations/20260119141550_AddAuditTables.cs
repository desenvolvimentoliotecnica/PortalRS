using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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
                        name: "FK_AuditEntityPropertyChanges_AuditEntityChanges_AuditEntityChangeId",
                        column: x => x.AuditEntityChangeId,
                        principalTable: "AuditEntityChanges",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditEntityPropertyChanges");

            migrationBuilder.DropTable(
                name: "AuditEntityChanges");

            migrationBuilder.DropTable(
                name: "AuditEvents");

            migrationBuilder.DropTable(
                name: "AuditTransactions");
        }
    }
}
