using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInboxCandidateLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CandidatoId",
                table: "InboxItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_InboxItems_CandidatoId",
                table: "InboxItems",
                column: "CandidatoId");

            migrationBuilder.AddForeignKey(
                name: "FK_InboxItems_Candidatos_CandidatoId",
                table: "InboxItems",
                column: "CandidatoId",
                principalTable: "Candidatos",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InboxItems_Candidatos_CandidatoId",
                table: "InboxItems");

            migrationBuilder.DropIndex(
                name: "IX_InboxItems_CandidatoId",
                table: "InboxItems");

            migrationBuilder.DropColumn(
                name: "CandidatoId",
                table: "InboxItems");
        }
    }
}
