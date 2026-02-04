using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations.Master
{
    /// <inheritdoc />
    public partial class AddTenantCreatedByOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByOwnerId",
                table: "Tenants",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_CreatedByOwnerId",
                table: "Tenants",
                column: "CreatedByOwnerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Tenants_Owners_CreatedByOwnerId",
                table: "Tenants",
                column: "CreatedByOwnerId",
                principalTable: "Owners",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tenants_Owners_CreatedByOwnerId",
                table: "Tenants");

            migrationBuilder.DropIndex(
                name: "IX_Tenants_CreatedByOwnerId",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "CreatedByOwnerId",
                table: "Tenants");
        }
    }
}
