using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMoodEntries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GamificationDailyStates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CurrentStreak = table.Column<int>(type: "integer", nullable: false),
                    BestStreak = table.Column<int>(type: "integer", nullable: false),
                    LastCheckInDate = table.Column<DateOnly>(type: "date", nullable: true),
                    LastActivityDate = table.Column<DateOnly>(type: "date", nullable: true),
                    FeedbackSentToday = table.Column<int>(type: "integer", nullable: false),
                    CelebrationPostsToday = table.Column<int>(type: "integer", nullable: false),
                    CelebrationCommentsToday = table.Column<int>(type: "integer", nullable: false),
                    OneOnOneCompletedToday = table.Column<int>(type: "integer", nullable: false),
                    DevelopmentPlansCreatedToday = table.Column<int>(type: "integer", nullable: false),
                    SurveyAnsweredToday = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GamificationDailyStates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GamificationDailyStates_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MoodEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Mood = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MoodEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MoodEntries_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RenderCoinTransactions_TenantId_UserId_SourceType_SourceId",
                table: "RenderCoinTransactions",
                columns: new[] { "TenantId", "UserId", "SourceType", "SourceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GamificationDailyStates_TenantId_LastCheckInDate",
                table: "GamificationDailyStates",
                columns: new[] { "TenantId", "LastCheckInDate" });

            migrationBuilder.CreateIndex(
                name: "IX_GamificationDailyStates_TenantId_UserId",
                table: "GamificationDailyStates",
                columns: new[] { "TenantId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GamificationDailyStates_UserId",
                table: "GamificationDailyStates",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_MoodEntries_TenantId_UserId_CreatedAtUtc",
                table: "MoodEntries",
                columns: new[] { "TenantId", "UserId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_MoodEntries_UserId",
                table: "MoodEntries",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GamificationDailyStates");

            migrationBuilder.DropTable(
                name: "MoodEntries");

            migrationBuilder.DropIndex(
                name: "IX_RenderCoinTransactions_TenantId_UserId_SourceType_SourceId",
                table: "RenderCoinTransactions");
        }
    }
}
