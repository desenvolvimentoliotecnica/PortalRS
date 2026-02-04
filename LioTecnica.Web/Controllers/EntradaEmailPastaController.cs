using System.Text.Json;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public class EntradaEmailPastaController : Controller
{
    private readonly InboxApiClient _inboxApi;
    private readonly VagasApiClient _vagasApi;
    private readonly CandidatosApiClient _candidatosApi;
    private readonly PortalTenantContext _tenantContext;

    public EntradaEmailPastaController(
        InboxApiClient inboxApi,
        VagasApiClient vagasApi,
        CandidatosApiClient candidatosApi,
        PortalTenantContext tenantContext)
    {
        _inboxApi = inboxApi;
        _vagasApi = vagasApi;
        _candidatosApi = candidatosApi;
        _tenantContext = tenantContext;
    }

    public IActionResult Index()
    {
        var model = new PageSeedViewModel { SeedJson = "{}" };
        return View(model);
    }

    [HttpGet("/EntradaEmailPasta/_api/inbox")]
    public async Task<IActionResult> GetInbox(
        [FromQuery] string? origem,
        [FromQuery] string? status,
        [FromQuery] Guid? vagaId,
        [FromQuery] string? q,
        CancellationToken ct)
    {
        var query = BuildQuery(origem, status, vagaId, q);
        var tenantId = _tenantContext.TenantId;
        var resp = await _inboxApi.GetInboxRawAsync(tenantId, query, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/EntradaEmailPasta/_api/inbox/{id:guid}")]
    public async Task<IActionResult> GetInboxById(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _inboxApi.GetInboxByIdRawAsync(tenantId, id, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/EntradaEmailPasta/_api/inbox")]
    public async Task<IActionResult> CreateInbox([FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _inboxApi.CreateRawAsync(tenantId, payload.GetRawText(), ct);
        return ToContentResult(resp);
    }

    [HttpPost("/EntradaEmailPasta/_api/upload")]
    public async Task<IActionResult> Upload(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Arquivo obrigatorio." });

        var tenantId = _tenantContext.TenantId;
        await using var stream = file.OpenReadStream();
        var contentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType;
        var resp = await _inboxApi.UploadAsync(tenantId, stream, file.FileName, contentType, ct);
        return ToContentResult(resp);
    }

    [HttpPut("/EntradaEmailPasta/_api/inbox/{id:guid}")]
    public async Task<IActionResult> UpdateInbox(Guid id, [FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _inboxApi.UpdateRawAsync(tenantId, id, payload.GetRawText(), ct);
        return ToContentResult(resp);
    }

    [HttpDelete("/EntradaEmailPasta/_api/inbox/{id:guid}")]
    public async Task<IActionResult> DeleteInbox(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _inboxApi.DeleteRawAsync(tenantId, id, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/EntradaEmailPasta/_api/inbox/{id:guid}/add-to-talentos")]
    public async Task<IActionResult> AddInboxItemToTalentos(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _inboxApi.AddToTalentosRawAsync(tenantId, id, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/EntradaEmailPasta/_api/vagas")]
    public async Task<IActionResult> GetVagas(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _vagasApi.GetVagasRawAsync(tenantId, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/EntradaEmailPasta/_api/candidatos")]
    public async Task<IActionResult> CreateCandidato([FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _candidatosApi.CreateRawAsync(tenantId, payload, ct);
        return ToContentResult(resp);
    }

    private static string BuildQuery(string? origem, string? status, Guid? vagaId, string? q)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(origem)) parts.Add($"origem={Uri.EscapeDataString(origem)}");
        if (!string.IsNullOrWhiteSpace(status)) parts.Add($"status={Uri.EscapeDataString(status)}");
        if (vagaId.HasValue) parts.Add($"vagaId={vagaId.Value}");
        if (!string.IsNullOrWhiteSpace(q)) parts.Add($"q={Uri.EscapeDataString(q)}");
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
