using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Application.Vagas.Handlers;
using RhPortal.Api.Contracts.Matching;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Gestão de vagas (uso interno do RH).
/// </summary>
[ApiController]
[Route("api/vagas")]
public sealed class VagasController : ControllerBase
{
    private readonly ICurrentUserContext _userContext;

    public VagasController(ICurrentUserContext userContext)
    {
        _userContext = userContext;
    }

    /// <summary>
    /// Lista vagas com filtros administrativos.
    /// </summary>
    /// <param name="q">Busca textual por título/código.</param>
    /// <param name="status">Status da vaga (Aberta, Fechada, etc.).</param>
    /// <param name="areaId">Filtrar por área.</param>
    /// <param name="departmentId">Filtrar por departamento.</param>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<VagaListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<VagaListItemResponse>>> List(
        [FromQuery] string? q,
        [FromQuery] VagaStatus? status,
        [FromQuery] Guid? areaId,
        [FromQuery] Guid? departmentId,
        [FromServices] IListVagasHandler handler,
        CancellationToken ct)
    {
        Guid? effectiveAreaId;
        Guid? recrutadorUserId = null;
        if (_userContext.IsAdmin || _userContext.IsInRole("Owner"))
        {
            effectiveAreaId = areaId;
        }
        else
        {
            if (_userContext.VagasDataScope == VagasDataScope.ByArea && _userContext.AreaId.HasValue)
            {
                effectiveAreaId = _userContext.AreaId;
            }
            else if (_userContext.VagasDataScope == VagasDataScope.ByRecrutador && _userContext.UserId.HasValue)
            {
                effectiveAreaId = null;
                recrutadorUserId = _userContext.UserId;
            }
            else
            {
                effectiveAreaId = areaId;
            }
        }

        var query = new VagaListQuery(q, status, effectiveAreaId, departmentId, recrutadorUserId);
        var items = await handler.HandleAsync(query, ct);
        return Ok(items);
    }

    /// <summary>
    /// Consulta uma vaga específica pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(VagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<VagaResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] IGetVagaByIdHandler handler,
        CancellationToken ct)
    {
        var item = await handler.HandleAsync(id, ct);
        if (item is null)
            return NotFound();
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner"))
        {
            if (_userContext.VagasDataScope == VagasDataScope.ByArea && _userContext.AreaId.HasValue && item.AreaId != _userContext.AreaId)
                return NotFound();
            if (_userContext.VagasDataScope == VagasDataScope.ByRecrutador && _userContext.UserId.HasValue && item.RecrutadorResponsavelUserId != _userContext.UserId)
                return NotFound();
        }
        return Ok(item);
    }

    /// <summary>
    /// Lista candidatos com score de matching para a vaga, ordenados por score (maior primeiro).
    /// </summary>
    /// <param name="id">ID da vaga.</param>
    /// <param name="minScore">Score mínimo (0 a 100).</param>
    /// <param name="take">Quantidade de itens (1 a 200).</param>
    [HttpGet("{id:guid}/matching-candidates")]
    [ProducesResponseType(typeof(IReadOnlyList<MatchingCandidateItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<MatchingCandidateItemResponse>>> GetMatchingCandidates(
        [FromRoute] Guid id,
        [FromServices] IMatchingService matchingService,
        [FromQuery] int minScore = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var items = await matchingService.GetCandidatesWithScoresAsync(id, minScore, take, ct);
        return Ok(items);
    }

    /// <summary>
    /// Cria uma nova vaga.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(VagaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<VagaResponse>> Create(
        [FromBody] VagaCreateRequest request,
        [FromServices] ICreateVagaHandler handler,
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
    /// Atualiza os dados de uma vaga existente.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(VagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<VagaResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] VagaUpdateRequest request,
        [FromServices] IUpdateVagaHandler handler,
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
    /// Remove uma vaga.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IDeleteVagaHandler handler,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsInRole("Owner") && _userContext.IsReadOnly)
            return Forbid();
        var deleted = await handler.HandleAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
