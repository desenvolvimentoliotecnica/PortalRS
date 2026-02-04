using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInbox : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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
                    PreviewText = table.Column<string>(type: "text", nullable: true),
                    ProcessamentoPct = table.Column<int>(type: "integer", nullable: false),
                    ProcessamentoEtapa = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ProcessamentoTentativas = table.Column<int>(type: "integer", nullable: false),
                    ProcessamentoUltimoErro = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    ProcessamentoLogRaw = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InboxItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InboxItems_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
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

            migrationBuilder.CreateIndex(
                name: "IX_InboxAttachments_InboxItemId",
                table: "InboxAttachments",
                column: "InboxItemId");

            migrationBuilder.CreateIndex(
                name: "IX_InboxAttachments_TenantId_InboxItemId",
                table: "InboxAttachments",
                columns: new[] { "TenantId", "InboxItemId" });

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InboxAttachments");

            migrationBuilder.DropTable(
                name: "InboxItems");
        }
    }
}
