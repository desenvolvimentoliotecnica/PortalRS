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
    [HttpGet("my-profile")]
    [ProducesResponseType(typeof(GamificationProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<GamificationProfileResponse>> GetMyProfile(
        [FromServices] GamificationService service,
        CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var result = await service.GetMyProfileAsync(userId, ct);
        return Ok(result);
    }

    [RequirePermission("feedback.gamificacao.view")]
    [HttpGet("daily-activities")]
    [ProducesResponseType(typeof(IReadOnlyList<DailyActivityResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyList<DailyActivityResponse>>> GetDailyActivities(
        [FromServices] GamificationService service,
        CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var result = await service.GetDailyActivitiesAsync(userId, ct);
        return Ok(result);
    }

    [RequirePermission("feedback.gamificacao.view")]
    [HttpGet("rules")]
    [ProducesResponseType(typeof(IReadOnlyList<GamificationRuleResponse>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<GamificationRuleResponse>> GetRules(
        [FromServices] GamificationService service)
    {
        var result = service.GetRules();
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

    // ── Catálogo de Recompensas (Entrega 1.8 — Fase 1 Paridade Feedz) ──

    [RequirePermission("feedback.gamificacao.view")]
    [HttpGet("rewards")]
    [ProducesResponseType(typeof(IReadOnlyList<RenderCoinRewardResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListRewards(
        [FromServices] IRenderCoinRewardService service,
        [FromQuery] bool incluirInativos,
        CancellationToken ct) =>
        Ok(await service.ListAsync(incluirInativos, ct));

    [RequirePermission("feedback.gamificacao.view")]
    [HttpGet("rewards/{id:guid}")]
    [ProducesResponseType(typeof(RenderCoinRewardResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetReward(
        Guid id,
        [FromServices] IRenderCoinRewardService service,
        CancellationToken ct)
    {
        var r = await service.GetAsync(id, ct);
        return r is null ? NotFound() : Ok(r);
    }

    [RequirePermission("feedback.gamificacao.view")]
    [HttpPost("rewards")]
    [ProducesResponseType(typeof(RenderCoinRewardResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateReward(
        [FromBody] RenderCoinRewardCreateRequest request,
        [FromServices] IRenderCoinRewardService service,
        CancellationToken ct)
    {
        try
        {
            var r = await service.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetReward), new { id = r.Id }, r);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Resgata uma recompensa (debita coins, cria solicitação no estado "Solicitado").</summary>
    [RequirePermission("feedback.gamificacao.view")]
    [HttpPost("rewards/redeem")]
    [ProducesResponseType(typeof(RenderCoinRedemptionResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RedeemReward(
        [FromBody] RenderCoinRedeemRequest request,
        [FromServices] IRenderCoinRewardService service,
        CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        try
        {
            var r = await service.RedeemAsync(userId, request, ct);
            return CreatedAtAction(nameof(ListRedemptions), null, r);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [RequirePermission("feedback.gamificacao.view")]
    [HttpGet("redemptions")]
    [ProducesResponseType(typeof(IReadOnlyList<RenderCoinRedemptionResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListRedemptions(
        [FromServices] IRenderCoinRewardService service,
        CancellationToken ct,
        [FromQuery] bool filterMine = false,
        [FromQuery] int? status = null)
    {
        Guid? filter = null;
        if (filterMine)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userIdClaim, out var userId)) return Unauthorized();
            filter = userId;
        }
        return Ok(await service.ListRedemptionsAsync(filter, status, ct));
    }

    [RequirePermission("feedback.gamificacao.view")]
    [HttpPut("redemptions/{id:guid}/status")]
    [ProducesResponseType(typeof(RenderCoinRedemptionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateRedemptionStatus(
        Guid id,
        [FromBody] RenderCoinRedemptionStatusUpdateRequest request,
        [FromServices] IRenderCoinRewardService service,
        CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var processadoPorUserId))
            return Unauthorized();

        try
        {
            var r = await service.UpdateRedemptionStatusAsync(id, request, processadoPorUserId, ct);
            return Ok(r);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
