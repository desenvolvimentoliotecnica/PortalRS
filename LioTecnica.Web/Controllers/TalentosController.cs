using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace LioTecnica.Web.Controllers;

[Authorize]
public sealed class TalentosController : Controller
{
    private readonly TalentosApiClient _api;
    private readonly PortalTenantContext _tenantContext;

    public TalentosController(TalentosApiClient api, PortalTenantContext tenantContext)
    {
        _api = api;
        _tenantContext = tenantContext;
    }

    [HttpGet("/Talentos")]
    public IActionResult Index()
    {
        var model = new PageSeedViewModel { SeedJson = "{}" };
        return View(model);
    }

    [HttpGet("/Talentos/_api/list")]
    public async Task<IActionResult> List(
        [FromQuery] string? q,
        [FromQuery] string? origem,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _api.ListRawAsync(tenantId, q, origem, page, pageSize, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Talentos/_api/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _api.GetByIdRawAsync(tenantId, id, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/Talentos/_api")]
    public async Task<IActionResult> Create([FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _api.CreateRawAsync(tenantId, payload, ct);
        return ToContentResult(resp);
    }

    [HttpPut("/Talentos/_api/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _api.UpdateRawAsync(tenantId, id, payload, ct);
        return ToContentResult(resp);
    }

    [HttpDelete("/Talentos/_api/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _api.DeleteRawAsync(tenantId, id, ct);
        return resp.StatusCode == System.Net.HttpStatusCode.NoContent ? NoContent() : ToContentResult(resp);
    }

    [HttpPost("/Talentos/_api/import-pdf")]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    public async Task<IActionResult> ImportPdf(
        [FromForm] IFormFile? arquivo,
        [FromForm] bool enviarParaGpt = false,
        [FromForm] Guid? talentoId = null,
        CancellationToken ct = default)
    {
        if (arquivo is null || arquivo.Length == 0)
            return BadRequest(new { message = "Arquivo PDF é obrigatório." });

        var tenantId = _tenantContext.TenantId;
        await using var stream = arquivo.OpenReadStream();
        var resp = await _api.ImportPdfRawAsync(tenantId, stream, arquivo.FileName ?? "curriculo.pdf", enviarParaGpt, talentoId, ct);
        return ToContentResult(resp);
    }

    /// <summary>Upload de currículo (PDF) no talento existente + extração de texto e dados sugeridos pela LLM para revisar na tela.</summary>
    [HttpPost("/Talentos/_api/{id:guid}/documentos/curriculo-extrair")]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    public async Task<IActionResult> UploadCurriculoEExtrair(
        Guid id,
        [FromForm] IFormFile? arquivo,
        [FromForm] bool enviarParaGpt = true,
        CancellationToken ct = default)
    {
        if (arquivo is null || arquivo.Length == 0)
            return BadRequest(new { message = "Arquivo PDF é obrigatório." });

        var ext = Path.GetExtension(arquivo.FileName)?.ToLowerInvariant() ?? "";
        if (ext != ".pdf")
            return BadRequest(new { message = "Apenas arquivos PDF são aceitos." });

        var tenantId = _tenantContext.TenantId;
        var resp = await _api.UploadCurriculoEExtrairRawAsync(tenantId, id, arquivo, enviarParaGpt, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/Talentos/_api/import-jobs/{id:guid}/aprovar")]
    public async Task<IActionResult> AprovarImportJob(Guid id, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _api.AprovarImportJobRawAsync(tenantId, id, ct);
        return resp.StatusCode == System.Net.HttpStatusCode.NoContent ? NoContent() : ToContentResult(resp);
    }

    [HttpPost("/Talentos/_api/import-jobs/{id:guid}/recusar")]
    public async Task<IActionResult> RecusarImportJob(Guid id, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _api.RecusarImportJobRawAsync(tenantId, id, ct);
        return resp.StatusCode == System.Net.HttpStatusCode.NoContent ? NoContent() : ToContentResult(resp);
    }

    [HttpGet("/Talentos/_api/{id:guid}/documentos/{docId:guid}/download")]
    public async Task<IActionResult> DownloadDocumento(Guid id, Guid docId, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _api.DownloadDocumentoAsync(tenantId, id, docId, ct);
        if (!resp.IsSuccessStatusCode)
            return StatusCode((int)resp.StatusCode);

        var bytes = await resp.Content.ReadAsByteArrayAsync(ct);
        var contentType = resp.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
        var fileName = resp.Content.Headers.ContentDisposition?.FileName?.Trim('"') ?? "documento.pdf";
        return File(bytes, contentType, fileName);
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
