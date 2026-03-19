using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Contracts.PreAdmissao;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Portal de Admissão — pré-admissão de funcionários com workflow de aprovação.
/// </summary>
[ApiController]
[Route("api/pre-admissao")]
[Authorize]
public sealed class PreAdmissaoController : ControllerBase
{
    private readonly IPreAdmissaoService _service;
    private readonly ICurrentUserContext _userContext;

    public PreAdmissaoController(IPreAdmissaoService service, ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    /// <summary>Lista pré-admissões com filtro e paginação.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<PreAdmissaoGridRow>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] string? q,
        [FromQuery] PreAdmissaoStatus? status,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken ct)
    {
        var query = new PreAdmissaoListQuery(q, status, page, pageSize);
        return Ok(await _service.ListAsync(query, ct));
    }

    /// <summary>Retorna detalhe de uma pré-admissão.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await _service.GetByIdAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Cria uma nova pré-admissão (rascunho).</summary>
    [HttpPost]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] PreAdmissaoCreateRequest request, CancellationToken ct)
    {
        var result = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>Atualiza dados de uma pré-admissão em rascunho.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] PreAdmissaoUpdateRequest request, CancellationToken ct)
    {
        var result = await _service.UpdateAsync(id, request, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Submete a pré-admissão para revisão do RH (Rascunho → EmRevisão).</summary>
    [HttpPost("{id:guid}/submit")]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct)
    {
        var result = await _service.SubmitAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Aprova a pré-admissão (EmRevisão → Aprovada).</summary>
    [HttpPost("{id:guid}/approve")]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Approve(Guid id, [FromBody] PreAdmissaoApproveRequest request, CancellationToken ct)
    {
        if (_userContext.FuncionarioId is not { } aprovadorId)
            return Forbid();
        var result = await _service.ApproveAsync(id, aprovadorId, request, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Rejeita a pré-admissão (EmRevisão → Rejeitada).</summary>
    [HttpPost("{id:guid}/reject")]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] PreAdmissaoRejectRequest request, CancellationToken ct)
    {
        var result = await _service.RejectAsync(id, request, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Busca por CPF para readmissão — retorna dados da pessoa se existir.</summary>
    [HttpGet("buscar-cpf/{cpf}")]
    [ProducesResponseType(typeof(BuscaCpfResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> BuscarCpf(string cpf, CancellationToken ct)
    {
        var result = await _service.BuscarPorCpfAsync(cpf, ct);
        return Ok(result);
    }

    /// <summary>Upload de documento na pré-admissão (máx 10 MB).</summary>
    [HttpPost("{id:guid}/documentos")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(PreAdmissaoDocumentoResponse), StatusCodes.Status201Created)]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> UploadDocumento(Guid id, [FromForm] UploadDocumentoRequest request, CancellationToken ct)
    {
        var ext = Path.GetExtension(request.File.FileName).ToLower();
        if (ext is not (".pdf" or ".jpg" or ".jpeg" or ".png"))
            return BadRequest("Tipo de arquivo não permitido. Use PDF, JPG ou PNG.");

        using var stream = request.File.OpenReadStream();
        var result = await _service.UploadDocumentoAsync(id, request.Tipo, request.File.FileName, request.File.ContentType, request.File.Length, stream, ct);
        return Created("", result);
    }

    /// <summary>Remove um documento da pré-admissão.</summary>
    [HttpDelete("{id:guid}/documentos/{docId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDocumento(Guid id, Guid docId, CancellationToken ct)
    {
        return await _service.DeleteDocumentoAsync(id, docId, ct) ? NoContent() : NotFound();
    }
}
