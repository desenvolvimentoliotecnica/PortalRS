using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing.Matching;
using System.Net;
using System.Text.Json;

namespace LioTecnica.Web.Controllers;

public class CandidatosController : Controller
{
    private readonly CandidatosApiClient _candidatosApi;
    private readonly PortalTenantContext _tenantContext;

    public CandidatosController(CandidatosApiClient candidatosApi, PortalTenantContext tenantContext)
    {
        _candidatosApi = candidatosApi;
        _tenantContext = tenantContext;
    }

    public IActionResult Index()
    {
        var model = new PageSeedViewModel { SeedJson = "{}" };
        return View(model);
    }

    [HttpGet("/api/candidatos")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? q,
        [FromQuery] string[]? statuses,
        [FromQuery] Guid[]? vagaIds,
        CancellationToken ct,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _candidatosApi.GetCandidatosRawAsync(tenantId, q, statuses, vagaIds, page, pageSize, ct);
        return ToContentResult(resp);
    }


    [HttpGet("/api/candidatos/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _candidatosApi.GetCandidatoByIdRawAsync(tenantId, id, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/api/candidatos")]
    public async Task<IActionResult> Create([FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _candidatosApi.CreateRawAsync(tenantId, payload, ct);
        return ToContentResult(resp);
    }

    [HttpPut("/api/candidatos/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _candidatosApi.UpdateRawAsync(tenantId, id, payload, ct);
        return ToContentResult(resp);
    }

    [HttpDelete("/api/candidatos/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _candidatosApi.DeleteRawAsync(tenantId, id, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/api/candidatos/{id:guid}/documentos")]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    public async Task<IActionResult> UploadDocumento(
        Guid id,
        [FromForm] IFormFile? arquivo,
        [FromForm] string? tipo,
        [FromForm] string? descricao,
        CancellationToken ct)
    {
        if (arquivo is null || arquivo.Length == 0)
            return BadRequest(new { message = "Arquivo invalido." });

        if (string.IsNullOrWhiteSpace(tipo))
            return BadRequest(new { message = "Tipo do documento e obrigatorio." });

        var tenantId = _tenantContext.TenantId;
        var resp = await _candidatosApi.UploadDocumentoRawAsync(tenantId, id, arquivo, tipo, descricao, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/api/candidatos/{id:guid}/documentos/{documentoId:guid}/download")]
    public async Task<IActionResult> DownloadDocumento(Guid id, Guid documentoId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _candidatosApi.DownloadDocumentoAsync(tenantId, id, documentoId, ct);

        if (resp.StatusCode != HttpStatusCode.OK)
            return new StatusCodeResult((int)resp.StatusCode);

        var contentType = string.IsNullOrWhiteSpace(resp.ContentType)
            ? "application/octet-stream"
            : resp.ContentType;

        var fileName = string.IsNullOrWhiteSpace(resp.FileName) ? "documento" : resp.FileName;
        return File(resp.Content, contentType, fileName);
    }

    [HttpDelete("/api/candidatos/{id:guid}/documentos/{documentoId:guid}")]
    public async Task<IActionResult> DeleteDocumento(Guid id, Guid documentoId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _candidatosApi.DeleteDocumentoRawAsync(tenantId, id, documentoId, ct);
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
