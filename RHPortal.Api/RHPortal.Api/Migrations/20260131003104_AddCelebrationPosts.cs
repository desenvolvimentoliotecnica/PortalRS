using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCelebrationPosts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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
                    table.ForeignKey(
                        name: "FK_CelebrationPosts_Users_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
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
                    table.ForeignKey(
                        name: "FK_CelebrationMentions_CelebrationPosts_PostId",
                        column: x => x.PostId,
                        principalTable: "CelebrationPosts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CelebrationMentions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CelebrationMentions");

            migrationBuilder.DropTable(
                name: "CelebrationPosts");
        }
    }
}
