using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Métricas agregadas de uso de IA do TENANT atual (não cross-tenant).
/// Cross-tenant fica em <c>OwnerAiController.GetUsageDetail/SummaryByTenant</c>.
///
/// <para>Fase 5 LLM-agnóstico (2026-04-26) — observabilidade básica antes
/// de Prometheus. Dados vêm de <c>AiUsageRecord</c> (Master DB).</para>
/// </summary>
[ApiController]
[Route("api/admin/ai/metrics")]
[Authorize]
public sealed class AiMetricsController : ControllerBase
{
    private readonly MasterDbContext _master;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext _userContext;

    public AiMetricsController(
        MasterDbContext master,
        ITenantContext tenantContext,
        ICurrentUserContext userContext)
    {
        _master = master;
        _tenantContext = tenantContext;
        _userContext = userContext;
    }

    public sealed record AiMetricsResponse(
        string TenantId,
        DateTimeOffset From,
        DateTimeOffset To,
        int TotalCalls,
        decimal TotalCostUsd,
        IReadOnlyList<AiMetricsByModule> ByModule,
        IReadOnlyList<AiMetricsByModel> ByModel,
        IReadOnlyList<AiMetricsByDay> ByDay
    );

    public sealed record AiMetricsByModule(string Module, int Calls, decimal CostUsd);
    public sealed record AiMetricsByModel(string ModelDisplayName, string Provider, int Calls, decimal CostUsd);
    public sealed record AiMetricsByDay(DateOnly Date, int Calls, decimal CostUsd);

    /// <summary>
    /// Métricas agregadas dos últimos N dias (default 30) para o tenant atual.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(AiMetricsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AiMetricsResponse>> Get(
        [FromQuery] int days = 30,
        CancellationToken ct = default)
    {
        if (!_userContext.IsAdmin)
            return Forbid();

        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId) || string.Equals(tenantId, "owner", StringComparison.OrdinalIgnoreCase))
            return Unauthorized();

        days = Math.Clamp(days, 1, 365);
        var to = DateTimeOffset.UtcNow;
        var from = to.AddDays(-days);

        var query = _master.AiUsageRecords
            .AsNoTracking()
            .Include(r => r.AiModel)
                .ThenInclude(m => m!.AiProviderKey)
            .Where(r => r.TenantId == tenantId && r.CreatedAtUtc >= from);

        var records = await query.ToListAsync(ct);

        var byModule = records
            .GroupBy(r => r.Module ?? "?")
            .Select(g => new AiMetricsByModule(g.Key, g.Count(), g.Sum(x => x.Cost)))
            .OrderByDescending(x => x.CostUsd)
            .ToList();

        var byModel = records
            .GroupBy(r => new
            {
                ModelDisplay = r.AiModel?.DisplayName ?? "?",
                Provider = r.AiModel?.AiProviderKey?.Provider ?? "?",
            })
            .Select(g => new AiMetricsByModel(g.Key.ModelDisplay, g.Key.Provider, g.Count(), g.Sum(x => x.Cost)))
            .OrderByDescending(x => x.CostUsd)
            .ToList();

        var byDay = records
            .GroupBy(r => DateOnly.FromDateTime(r.CreatedAtUtc.UtcDateTime))
            .Select(g => new AiMetricsByDay(g.Key, g.Count(), g.Sum(x => x.Cost)))
            .OrderBy(x => x.Date)
            .ToList();

        var response = new AiMetricsResponse(
            TenantId: tenantId,
            From: from,
            To: to,
            TotalCalls: records.Count,
            TotalCostUsd: records.Sum(r => r.Cost),
            ByModule: byModule,
            ByModel: byModel,
            ByDay: byDay
        );

        return Ok(response);
    }
}
