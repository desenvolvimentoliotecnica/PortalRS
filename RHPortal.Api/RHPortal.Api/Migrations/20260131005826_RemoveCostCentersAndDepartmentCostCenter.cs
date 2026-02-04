using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveCostCentersAndDepartmentCostCenter : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CostCenters");

            migrationBuilder.DropColumn(
                name: "CostCenter",
                table: "Departments");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CostCenter",
                table: "Departments",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CostCenters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    GroupName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UnitName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CostCenters", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CostCenters_TenantId_Code",
                table: "CostCenters",
                columns: new[] { "TenantId", "Code" },
                unique: true);
        }
    }
}
