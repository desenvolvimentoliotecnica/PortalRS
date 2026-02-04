using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAreaHierarchyAndOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "OwnerManagerId",
                table: "Areas",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ParentId",
                table: "Areas",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Areas_OwnerManagerId",
                table: "Areas",
                column: "OwnerManagerId");

            migrationBuilder.CreateIndex(
                name: "IX_Areas_ParentId",
                table: "Areas",
                column: "ParentId");

            migrationBuilder.AddForeignKey(
                name: "FK_Areas_Areas_ParentId",
                table: "Areas",
                column: "ParentId",
                principalTable: "Areas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Areas_Managers_OwnerManagerId",
                table: "Areas",
                column: "OwnerManagerId",
                principalTable: "Managers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Areas_Areas_ParentId",
                table: "Areas");

            migrationBuilder.DropForeignKey(
                name: "FK_Areas_Managers_OwnerManagerId",
                table: "Areas");

            migrationBuilder.DropIndex(
                name: "IX_Areas_OwnerManagerId",
                table: "Areas");

            migrationBuilder.DropIndex(
                name: "IX_Areas_ParentId",
                table: "Areas");

            migrationBuilder.DropColumn(
                name: "OwnerManagerId",
                table: "Areas");

            migrationBuilder.DropColumn(
                name: "ParentId",
                table: "Areas");
        }
    }
}
