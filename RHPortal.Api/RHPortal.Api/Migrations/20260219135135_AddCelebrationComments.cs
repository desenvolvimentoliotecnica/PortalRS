using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCelebrationComments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CandidatoVagaMatchingScores",
                columns: table => new
                {
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Score = table.Column<int>(type: "integer", nullable: false),
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
                    table.ForeignKey(
                        name: "FK_CandidatoVagaMatchingScores_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
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
                    table.ForeignKey(
                        name: "FK_CelebrationComments_CelebrationPosts_PostId",
                        column: x => x.PostId,
                        principalTable: "CelebrationPosts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CelebrationComments_Users_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
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
                    table.ForeignKey(
                        name: "FK_CelebrationCommentMentions_CelebrationComments_CommentId",
                        column: x => x.CommentId,
                        principalTable: "CelebrationComments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CelebrationCommentMentions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoVagaMatchingScores_VagaId_Score",
                table: "CandidatoVagaMatchingScores",
                columns: new[] { "VagaId", "Score" });

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidatoVagaMatchingScores");

            migrationBuilder.DropTable(
                name: "CelebrationCommentMentions");

            migrationBuilder.DropTable(
                name: "CelebrationComments");
        }
    }
}
