using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Text.Json;

namespace LioTecnica.Web.Controllers;

public sealed class BloqueioPessoaController : Controller
{
    private readonly BloqueioPessoaApiClient _api;
    private readonly PortalTenantContext _tenantContext;

    public BloqueioPessoaController(BloqueioPessoaApiClient api, PortalTenantContext tenantContext)
    {
        _api = api;
        _tenantContext = tenantContext;
    }

    [HttpGet("/BloqueioPessoa")]
    public IActionResult IndexRedirect()
    {
        return RedirectToAction("Index", "Pessoas");
    }

    [HttpGet("/api/bloqueio-pessoa")]
    public async Task<IActionResult> List(
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var resp = await _api.ListAsync(tenantId, q, page, pageSize, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/api/bloqueio-pessoa/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var resp = await _api.GetByIdAsync(tenantId, id, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/api/bloqueio-pessoa")]
    public async Task<IActionResult> CreateManual([FromBody] JsonElement payload, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var nome = payload.TryGetProperty("nome", out var n) ? n.GetString() ?? "" : "";
        var email = payload.TryGetProperty("email", out var e) ? e.GetString() ?? "" : "";
        var motivo = payload.TryGetProperty("motivo", out var m) ? m.GetString() : null;
        var resp = await _api.CreateManualAsync(tenantId, nome, email, motivo, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/api/bloqueio-pessoa/from-candidato/{candidatoId:guid}")]
    public async Task<IActionResult> CreateFromCandidato(Guid candidatoId, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var resp = await _api.CreateFromCandidatoAsync(tenantId, candidatoId, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/api/bloqueio-pessoa/from-funcionario/{funcionarioId:guid}")]
    public async Task<IActionResult> CreateFromFuncionario(Guid funcionarioId, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var resp = await _api.CreateFromFuncionarioAsync(tenantId, funcionarioId, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/api/bloqueio-pessoa/from-talento/{talentoId:guid}")]
    public async Task<IActionResult> CreateFromTalento(Guid talentoId, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var resp = await _api.CreateFromTalentoAsync(tenantId, talentoId, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/api/bloqueio-pessoa/block/{pessoaId:guid}")]
    public async Task<IActionResult> BlockByPessoaId(Guid pessoaId, [FromBody] JsonElement? payload, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        string? motivo = null;
        if (payload.HasValue && payload.Value.TryGetProperty("motivo", out var m))
            motivo = m.GetString();
        var resp = await _api.BlockByPessoaIdAsync(tenantId, pessoaId, motivo, ct);
        return ToContentResult(resp);
    }

    [HttpDelete("/api/bloqueio-pessoa/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var resp = await _api.DeleteAsync(tenantId, id, ct);
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
