using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Candidatos;
using RhPortal.Api.Application.Candidatos.Handlers;
using RhPortal.Api.Contracts.Candidatos;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/candidatos")]
public sealed class CandidatosController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public CandidatosController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CandidatoListItemResponse>>> List(
        [FromQuery] string? q,
        [FromQuery] CandidatoStatus? status,
        [FromQuery] Guid? vagaId,
        [FromQuery] CandidatoFonte? fonte,
        [FromServices] IListCandidatosHandler handler,
        CancellationToken ct)
    {
        var query = new CandidatoListQuery(q, status, vagaId, fonte);
        var items = await handler.HandleAsync(query, ct);
        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CandidatoResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] IGetCandidatoByIdHandler handler,
        CancellationToken ct)
    {
        var item = await handler.HandleAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<CandidatoResponse>> Create(
        [FromBody] CandidatoCreateRequest request,
        [FromServices] ICreateCandidatoHandler handler,
        CancellationToken ct)
    {
        try
        {
            var created = await handler.HandleAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CandidatoResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] CandidatoUpdateRequest request,
        [FromServices] IUpdateCandidatoHandler handler,
        CancellationToken ct)
    {
        try
        {
            var updated = await handler.HandleAsync(id, request, ct);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IDeleteCandidatoHandler handler,
        CancellationToken ct)
    {
        var deleted = await handler.HandleAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/documentos")]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    [Consumes("multipart/form-data")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<ActionResult<CandidatoDocumentoResponse>> UploadDocumento(
        [FromRoute] Guid id,
        [FromForm] CandidatoDocumentoUploadRequest request,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        if (request.Arquivo is null || request.Arquivo.Length == 0)
            return BadRequest(new { message = _localizer["ControllerErrors.CandidatoDocumentoFileInvalid"] });

        if (string.IsNullOrWhiteSpace(request.Tipo))
            return BadRequest(new { message = _localizer["ControllerErrors.CandidatoDocumentoTypeRequired"] });

        if (!Enum.TryParse<CandidatoDocumentoTipo>(request.Tipo, true, out var tipo))
            return BadRequest(new { message = _localizer["ControllerErrors.CandidatoDocumentoTypeInvalid"] });

        try
        {
            var created = await service.AddDocumentoAsync(id, tipo, request.Descricao, request.Arquivo, ct);
            return created is null ? NotFound() : Ok(created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (DbUpdateException ex)
        {
            return Problem(statusCode: StatusCodes.Status500InternalServerError, detail: ex.InnerException?.Message ?? ex.Message);
        }
        catch (IOException ex)
        {
            return Problem(statusCode: StatusCodes.Status500InternalServerError, detail: ex.Message);
        }
    }

    [HttpGet("{id:guid}/documentos/{documentoId:guid}/download")]
    public async Task<IActionResult> DownloadDocumento(
        [FromRoute] Guid id,
        [FromRoute] Guid documentoId,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        var file = await service.GetDocumentoFileAsync(id, documentoId, ct);
        if (file is null) return NotFound();

        var contentType = string.IsNullOrWhiteSpace(file.ContentType)
            ? "application/octet-stream"
            : file.ContentType;

        return PhysicalFile(file.FilePath, contentType, file.FileName);
    }

    [HttpDelete("{id:guid}/documentos/{documentoId:guid}")]
    public async Task<IActionResult> DeleteDocumento(
        [FromRoute] Guid id,
        [FromRoute] Guid documentoId,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        var deleted = await service.DeleteDocumentoAsync(id, documentoId, ct);
        return deleted ? NoContent() : NotFound();
    }

    [HttpGet("{id:guid}/status-history")]
    public async Task<ActionResult<IReadOnlyList<CandidatoStatusHistoryItemResponse>>> GetStatusHistory(
        [FromRoute] Guid id,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        var items = await service.ListStatusHistoryAsync(id, ct);
        return Ok(items);
    }
}
