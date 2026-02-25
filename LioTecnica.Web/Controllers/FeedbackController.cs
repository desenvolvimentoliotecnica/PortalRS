using System.Text.Json;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

/// <summary>
/// Módulo Feedback: Celebração, Enviar feedback, Feedbacks, Meus planos, Reuniões 1:1, Gamificação, Gestão.
/// </summary>
public class FeedbackController : Controller
{
    private readonly FeedbackApiClient _feedbackApi;
    private readonly UsersApiClient _usersApi;
    private readonly PortalTenantContext _tenantContext;

    public FeedbackController(FeedbackApiClient feedbackApi, UsersApiClient usersApi, PortalTenantContext tenantContext)
    {
        _feedbackApi = feedbackApi;
        _usersApi = usersApi;
        _tenantContext = tenantContext;
    }

    // Quando acessar /Feedback/ redirecionar para a tela Início (Feedbacks) por padrão
    public IActionResult Index() => RedirectToAction(nameof(Feedbacks));

    public IActionResult Celebracao() => View();
    // Tela Desenvolvimento desativada: redireciona para Celebração
    public IActionResult Enviar() => View();
    public IActionResult Feedbacks() => View();
    public IActionResult MeusPlanos() => RedirectToAction(nameof(Celebracao));
    public IActionResult Reunioes1a1() => View();
    public IActionResult Gamificacao() => View();
    public IActionResult GamificacaoHistorico() => View();
    // Compat: item de menu antigo apontava para /Feedback/GamificacaoRanking
    public IActionResult GamificacaoRanking() => View("Gamificacao");
    // Tela Pesquisas desativada temporariamente.
    public IActionResult Pesquisas() => RedirectToAction(nameof(Celebracao));
    public IActionResult Gestao() => View();

    [HttpGet("/Feedback/_api/celebrations/feed")]
    public async Task<IActionResult> GetCelebrationFeed(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? filter = null,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.GetCelebrationFeedRawAsync(tenantId ?? "", page, pageSize, filter, from, to, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/Feedback/_api/celebrations")]
    public async Task<IActionResult> CreateCelebration([FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.CreateCelebrationPostRawAsync(tenantId ?? "", payload, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Feedback/_api/celebrations/mention-users")]
    public async Task<IActionResult> GetCelebrationMentionUsers([FromQuery] string? q, [FromQuery] int take = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.GetCelebrationMentionUsersRawAsync(tenantId ?? "", q, take, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Feedback/_api/celebrations/{postId:guid}/comments")]
    public async Task<IActionResult> GetCelebrationComments(Guid postId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.GetCelebrationCommentsRawAsync(tenantId ?? "", postId, page, pageSize, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/Feedback/_api/celebrations/{postId:guid}/comments")]
    public async Task<IActionResult> CreateCelebrationComment(Guid postId, [FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.CreateCelebrationCommentRawAsync(tenantId ?? "", postId, payload, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/Feedback/_api/celebrations/comments/{commentId:guid}/reactions")]
    public async Task<IActionResult> ToggleCelebrationCommentReaction(Guid commentId, [FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.ToggleCelebrationCommentReactionRawAsync(tenantId ?? "", commentId, payload, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/Feedback/_api/items")]
    public async Task<IActionResult> CreateFeedback([FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.CreateFeedbackRawAsync(tenantId ?? "", payload, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Feedback/_api/items/mine")]
    public async Task<IActionResult> GetFeedbackMine([FromQuery] string? filter, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.GetFeedbackMineRawAsync(tenantId ?? "", filter, page, pageSize, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Feedback/_api/items/all")]
    public async Task<IActionResult> GetFeedbackAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.GetFeedbackAllRawAsync(tenantId ?? "", page, pageSize, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Feedback/_api/users")]
    public async Task<IActionResult> GetUsers(CancellationToken ct)
    {
        var users = await _usersApi.ListAsync(ct);
        return Json(users);
    }

    [HttpGet("/Feedback/_api/plans/my")]
    public async Task<IActionResult> GetPlansMy([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.GetPlansMyRawAsync(tenantId ?? "", page, pageSize, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Feedback/_api/plans/team")]
    public async Task<IActionResult> GetPlansTeam([FromQuery] Guid? targetUserId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.GetPlansTeamRawAsync(tenantId ?? "", targetUserId, page, pageSize, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Feedback/_api/oneonone")]
    public async Task<IActionResult> GetOneOnOneList([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.GetOneOnOneListRawAsync(tenantId ?? "", page, pageSize, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Feedback/_api/oneonone/{id:guid}")]
    public async Task<IActionResult> GetOneOnOneById(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.GetOneOnOneByIdRawAsync(tenantId ?? "", id, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/Feedback/_api/oneonone")]
    public async Task<IActionResult> CreateOneOnOne([FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.CreateOneOnOneRawAsync(tenantId ?? "", payload, ct);
        return ToContentResult(resp);
    }

    [HttpPut("/Feedback/_api/oneonone/{id:guid}")]
    public async Task<IActionResult> UpdateOneOnOne(Guid id, [FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.UpdateOneOnOneRawAsync(tenantId ?? "", id, payload, ct);
        return ToContentResult(resp);
    }

    [HttpDelete("/Feedback/_api/oneonone/{id:guid}")]
    public async Task<IActionResult> DeleteOneOnOne(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.DeleteOneOnOneRawAsync(tenantId ?? "", id, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Feedback/_api/gamification/leaderboard")]
    public async Task<IActionResult> GetGamificationLeaderboard([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.GetGamificationLeaderboardRawAsync(tenantId ?? "", page, pageSize, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Feedback/_api/gamification/my-balance")]
    public async Task<IActionResult> GetGamificationMyBalance(CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.GetGamificationMyBalanceRawAsync(tenantId ?? "", ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Feedback/_api/gamification/history")]
    public async Task<IActionResult> GetGamificationHistory([FromQuery] int months = 12, [FromQuery] decimal goal = 5000, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _feedbackApi.GetGamificationHistoryRawAsync(tenantId ?? "", months: months, goal: goal, ct: ct);
        return ToContentResult(resp);
    }

    private static IActionResult ToContentResult(ApiRawResponse resp)
    {
        if (string.IsNullOrWhiteSpace(resp.Content))
            return new StatusCodeResult((int)resp.StatusCode);
        return new ContentResult
        {
            StatusCode = (int)resp.StatusCode,
            ContentType = "application/json",
            Content = resp.Content
        };
    }
}
