using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCelebrationCommentReactions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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
                    table.ForeignKey(
                        name: "FK_CelebrationCommentReactions_CelebrationComments_CommentId",
                        column: x => x.CommentId,
                        principalTable: "CelebrationComments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CelebrationCommentReactions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CelebrationCommentReactions");
        }
    }
}
