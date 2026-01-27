using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Candidatos;
using RhPortal.Api.Application.Candidatos.Handlers;
using RhPortal.Api.Contracts.Candidates;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Candidatos (admin/RH): cadastro, atualização, documentos e histórico.
/// </summary>
[ApiController]
[Route("api/candidatos")]
public sealed class CandidatosController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public CandidatosController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    /// <summary>
    /// Lista candidatos com filtros (busca, status, vaga e origem).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CandidateListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CandidateListItemResponse>>> List(
        [FromQuery] string? q,
        [FromQuery] CandidateStatus? status,
        [FromQuery] Guid? vagaId,
        [FromQuery] CandidateOrigin? fonte,
        [FromServices] IListCandidatosHandler handler,
        CancellationToken ct)
    {
        var query = new CandidateListQuery(q, status, vagaId, fonte);
        var items = await handler.HandleAsync(query, ct);
        return Ok(items);
    }

    /// <summary>
    /// Obtém um candidato pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CandidateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CandidateResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] IGetCandidatoByIdHandler handler,
        CancellationToken ct)
    {
        var item = await handler.HandleAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Cria um novo candidato.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CandidateResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CandidateResponse>> Create(
        [FromBody] CandidateCreateRequest request,
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

    /// <summary>
    /// Atualiza um candidato existente.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CandidateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CandidateResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] CandidateUpdateRequest request,
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

    /// <summary>
    /// Remove um candidato.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IDeleteCandidatoHandler handler,
        CancellationToken ct)
    {
        var deleted = await handler.HandleAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }

    /// <summary>
    /// Envia um documento do candidato (upload).
    /// </summary>
    [HttpPost("{id:guid}/documentos")]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    [Consumes("multipart/form-data")]
    [ApiExplorerSettings(IgnoreApi = true)]
    [ProducesResponseType(typeof(CandidateDocumentoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CandidateDocumentoResponse>> UploadDocumento(
        [FromRoute] Guid id,
        [FromForm] CandidateDocumentoUploadRequest request,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        if (request.Arquivo is null || request.Arquivo.Length == 0)
            return BadRequest(new { message = _localizer["ControllerErrors.CandidatoDocumentoFileInvalid"] });

        if (string.IsNullOrWhiteSpace(request.Tipo))
            return BadRequest(new { message = _localizer["ControllerErrors.CandidatoDocumentoTypeRequired"] });

        if (!Enum.TryParse<CandidateDocumentType>(request.Tipo, true, out var tipo))
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

    /// <summary>
    /// Faz download de um documento do candidato.
    /// </summary>
    [HttpGet("{id:guid}/documentos/{documentoId:guid}/download")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Remove um documento do candidato.
    /// </summary>
    [HttpDelete("{id:guid}/documentos/{documentoId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDocumento(
        [FromRoute] Guid id,
        [FromRoute] Guid documentoId,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        var deleted = await service.DeleteDocumentoAsync(id, documentoId, ct);
        return deleted ? NoContent() : NotFound();
    }

    /// <summary>
    /// Lista o histórico de status do candidato.
    /// </summary>
    [HttpGet("{id:guid}/status-history")]
    [ProducesResponseType(typeof(IReadOnlyList<CandidateStatusHistoryItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CandidateStatusHistoryItemResponse>>> GetStatusHistory(
        [FromRoute] Guid id,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        var items = await service.ListStatusHistoryAsync(id, ct);
        return Ok(items);
    }
}
