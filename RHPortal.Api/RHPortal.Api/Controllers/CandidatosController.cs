using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Candidatos;
using RhPortal.Api.Application.Candidatos.Handlers;
using RhPortal.Api.Contracts.Candidates;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Candidatos (admin/RH): cadastro, atualização, documentos e histórico.
/// </summary>
[ApiController]
[Route("api/candidatos")]
public sealed class CandidatosController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;
    private readonly ICurrentUserContext _userContext;

    public CandidatosController(IStringLocalizer<ControllerMessages> localizer, ICurrentUserContext userContext)
    {
        _localizer = localizer;
        _userContext = userContext;
    }

    /// <summary>
    /// Lista candidatos com filtros (busca, status(es), vaga(s)) e paginação.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(CandidatePagedResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<CandidatePagedResponse>> List(
        [FromQuery] string? q,
        [FromQuery] CandidateStatus? status,
        [FromQuery] CandidateStatus[]? statuses,
        [FromQuery] Guid? vagaId,
        [FromQuery] Guid[]? vagaIds,
        [FromQuery] CandidateOrigin? fonte,
        [FromServices] IListCandidatosHandler handler,
        CancellationToken ct,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        Guid? areaId = null;
        Guid? recrutadorUserId = null;
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner"))
        {
            if (_userContext.VagasDataScope == VagasDataScope.ByArea && _userContext.AreaId.HasValue)
                areaId = _userContext.AreaId;
            else if (_userContext.VagasDataScope == VagasDataScope.ByRecrutador && _userContext.UserId.HasValue)
                recrutadorUserId = _userContext.UserId;
        }
        var statusList = statuses is { Length: > 0 } ? statuses.ToList() : null;
        var vagaIdList = vagaIds is { Length: > 0 } ? vagaIds.ToList() : null;
        var query = new CandidateListQuery(q, status, statusList, vagaId, vagaIdList, fonte, areaId, recrutadorUserId, page, pageSize);
        var result = await handler.HandleAsync(query, ct);
        return Ok(result);
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
        if (item is null)
            return NotFound();
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner"))
        {
            if (_userContext.VagasDataScope == VagasDataScope.ByArea && _userContext.AreaId.HasValue && item.VagaAreaId.HasValue && item.VagaAreaId != _userContext.AreaId)
                return NotFound();
            if (_userContext.VagasDataScope == VagasDataScope.ByRecrutador && _userContext.UserId.HasValue && item.VagaRecrutadorResponsavelUserId != _userContext.UserId)
                return NotFound();
        }
        return Ok(item);
    }

    /// <summary>
    /// Cria um novo candidato.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CandidateResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CandidateResponse>> Create(
        [FromBody] CandidateCreateRequest request,
        [FromServices] ICreateCandidatoHandler handler,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner") && _userContext.IsReadOnly)
            return Forbid();
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
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CandidateResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] CandidateUpdateRequest request,
        [FromServices] IUpdateCandidatoHandler handler,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner") && _userContext.IsReadOnly)
            return Forbid();
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
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IDeleteCandidatoHandler handler,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner") && _userContext.IsReadOnly)
            return Forbid();
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
    /// Upload de currículo (PDF), extração de texto e dados sugeridos pela LLM para revisar na tela e aplicar no candidato/talento.
    /// </summary>
    [HttpPost("{id:guid}/documentos/curriculo-extrair")]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(CandidatoCurriculoExtrairResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CandidatoCurriculoExtrairResponse>> UploadCurriculoEExtrair(
        [FromRoute] Guid id,
        [FromForm] IFormFile? arquivo,
        [FromServices] ICandidatoService service,
        CancellationToken ct,
        [FromForm] bool enviarParaGpt = true)
    {
        if (arquivo is null || arquivo.Length == 0)
            return BadRequest(new { message = "Arquivo PDF é obrigatório." });

        var ext = Path.GetExtension(arquivo.FileName)?.ToLowerInvariant() ?? string.Empty;
        if (ext != ".pdf")
            return BadRequest(new { message = "Apenas arquivos PDF são aceitos." });

        try
        {
            var result = await service.UploadCurriculoEExtrairAsync(id, arquivo, enviarParaGpt, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
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
