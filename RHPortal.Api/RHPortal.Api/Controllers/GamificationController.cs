using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Feedback;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/feedback/gamification")]
public sealed class GamificationController : ControllerBase
{
    [RequirePermission("feedback.gamificacao.view")]
    [HttpGet("leaderboard")]
    [ProducesResponseType(typeof(LeaderboardResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<LeaderboardResponse>> GetLeaderboard(
        [FromServices] GamificationService service,
        CancellationToken ct,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await service.GetLeaderboardAsync(page, pageSize, ct);
        return Ok(result);
    }

    [RequirePermission("feedback.gamificacao.view")]
    [HttpGet("my-balance")]
    [ProducesResponseType(typeof(MyBalanceResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<MyBalanceResponse>> GetMyBalance(
        [FromServices] GamificationService service,
        CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var result = await service.GetMyBalanceAsync(userId, ct);
        return Ok(result);
    }

    [RequirePermission("feedback.gamificacao.view")]
    [HttpGet("history")]
    [ProducesResponseType(typeof(MonthlyTop3HistoryResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<MonthlyTop3HistoryResponse>> GetHistory(
        [FromServices] GamificationService service,
        CancellationToken ct,
        [FromQuery] int months = 6,
        [FromQuery] decimal goal = 5000)
    {
        var result = await service.GetMonthlyTop3HistoryAsync(months, goal, ct);
        return Ok(result);
    }
}
