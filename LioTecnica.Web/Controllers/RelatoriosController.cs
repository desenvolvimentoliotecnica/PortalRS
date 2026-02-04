using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public class RelatoriosController : Controller
{
    private readonly ReportsApiClient _reportsApi;
    private readonly PortalTenantContext _tenantContext;

    public RelatoriosController(ReportsApiClient reportsApi, PortalTenantContext tenantContext)
    {
        _reportsApi = reportsApi;
        _tenantContext = tenantContext;
    }

    public IActionResult Index()
    {
        var model = new PageSeedViewModel { SeedJson = "{}" };
        return View(model);
    }

    [HttpGet("/Relatorios/_api/catalog")]
    public async Task<IActionResult> GetCatalog(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _reportsApi.GetCatalogRawAsync(tenantId, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Relatorios/_api/vagas")]
    public async Task<IActionResult> GetVagas(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _reportsApi.GetVagasRawAsync(tenantId, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Relatorios/_api/entrada-origem")]
    public async Task<IActionResult> GetEntradaOrigem(
        [FromQuery] string? period,
        [FromQuery] Guid? vagaId,
        [FromQuery] string? origem,
        [FromQuery] string? status,
        [FromQuery] string? q,
        CancellationToken ct)
    {
        var query = BuildQuery(period, vagaId, origem, status, q);
        var tenantId = _tenantContext.TenantId;
        var resp = await _reportsApi.GetEntradaOrigemRawAsync(tenantId, query, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Relatorios/_api/falhas-processamento")]
    public async Task<IActionResult> GetFalhasProcessamento(
        [FromQuery] string? period,
        [FromQuery] Guid? vagaId,
        [FromQuery] string? origem,
        [FromQuery] string? status,
        [FromQuery] string? q,
        CancellationToken ct)
    {
        var query = BuildQuery(period, vagaId, origem, status, q);
        var tenantId = _tenantContext.TenantId;
        var resp = await _reportsApi.GetFalhasProcessamentoRawAsync(tenantId, query, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Relatorios/_api/pipeline-status")]
    public async Task<IActionResult> GetPipelineStatus(
        [FromQuery] string? period,
        [FromQuery] Guid? vagaId,
        [FromQuery] string? origem,
        [FromQuery] string? status,
        [FromQuery] string? q,
        CancellationToken ct)
    {
        var query = BuildQuery(period, vagaId, origem, status, q);
        var tenantId = _tenantContext.TenantId;
        var resp = await _reportsApi.GetPipelineStatusRawAsync(tenantId, query, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Relatorios/_api/funil-vaga")]
    public async Task<IActionResult> GetFunilVaga(
        [FromQuery] string? period,
        [FromQuery] Guid? vagaId,
        [FromQuery] string? origem,
        [FromQuery] string? status,
        [FromQuery] string? q,
        CancellationToken ct)
    {
        var query = BuildQuery(period, vagaId, origem, status, q);
        var tenantId = _tenantContext.TenantId;
        var resp = await _reportsApi.GetFunilVagaRawAsync(tenantId, query, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Relatorios/_api/ranking-matching")]
    public async Task<IActionResult> GetRankingMatching(
        [FromQuery] string? period,
        [FromQuery] Guid? vagaId,
        [FromQuery] string? origem,
        [FromQuery] string? status,
        [FromQuery] string? q,
        [FromQuery] int take,
        CancellationToken ct)
    {
        var query = BuildQuery(period, vagaId, origem, status, q);
        query += $"&take={take}";
        var tenantId = _tenantContext.TenantId;
        var resp = await _reportsApi.GetRankingMatchingRawAsync(tenantId, query, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Relatorios/_api/sla-vaga")]
    public async Task<IActionResult> GetSlaVaga(
        [FromQuery] string? period,
        [FromQuery] Guid? areaId,
        [FromQuery] string? recrutador,
        [FromQuery] string? status,
        CancellationToken ct)
    {
        var query = BuildSlaVagaQuery(period, areaId, recrutador, status);
        var tenantId = _tenantContext.TenantId;
        var resp = await _reportsApi.GetSlaVagaRawAsync(tenantId, query, ct);
        return ToContentResult(resp);
    }

    private static string BuildQuery(string? period, Guid? vagaId, string? origem, string? status, string? q)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(period)) parts.Add($"period={Uri.EscapeDataString(period)}");
        if (vagaId.HasValue) parts.Add($"vagaId={vagaId.Value}");
        if (!string.IsNullOrWhiteSpace(origem)) parts.Add($"origem={Uri.EscapeDataString(origem)}");
        if (!string.IsNullOrWhiteSpace(status)) parts.Add($"status={Uri.EscapeDataString(status)}");
        if (!string.IsNullOrWhiteSpace(q)) parts.Add($"q={Uri.EscapeDataString(q)}");
        return parts.Count == 0 ? string.Empty : "?" + string.Join("&", parts);
    }

    private static string BuildSlaVagaQuery(string? period, Guid? areaId, string? recrutador, string? status)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(period)) parts.Add($"period={Uri.EscapeDataString(period)}");
        if (areaId.HasValue && areaId.Value != Guid.Empty) parts.Add($"areaId={areaId.Value}");
        if (!string.IsNullOrWhiteSpace(recrutador)) parts.Add($"recrutador={Uri.EscapeDataString(recrutador)}");
        if (!string.IsNullOrWhiteSpace(status)) parts.Add($"status={Uri.EscapeDataString(status)}");
        return parts.Count == 0 ? string.Empty : "?" + string.Join("&", parts);
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
