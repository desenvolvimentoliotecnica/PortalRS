using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    public partial class AddGamificationDailyStateAndIdempotency : Migration
    {
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

            migrationBuilder.Sql(@"
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_RenderCoinTransactions_TenantId_UserId_SourceType_SourceId""
                ON ""RenderCoinTransactions"" (""TenantId"", ""UserId"", ""SourceType"", ""SourceId"")
                WHERE ""SourceType"" IS NOT NULL AND ""SourceId"" IS NOT NULL;
            ");
            migrationBuilder.Sql(@"
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_SurveyResponses_TenantId_SurveyId_UserId""
                ON ""SurveyResponses"" (""TenantId"", ""SurveyId"", ""UserId"");
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_RenderCoinTransactions_TenantId_UserId_SourceType_SourceId"";");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_SurveyResponses_TenantId_SurveyId_UserId"";");

            migrationBuilder.DropTable(
                name: "GamificationDailyStates");
        }
    }
}
