using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.SolicitacoesDependente;
using RhPortal.Api.Contracts.SolicitacoesDependente;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Solicitações de inclusão/alteração/exclusão de dependentes (com workflow de aprovação pelo RH).
/// </summary>
[ApiController]
[Route("api/colaborador/solicitacoes-dependente")]
public sealed class SolicitacoesDependenteController : ControllerBase
{
    private readonly ISolicitacaoDependenteService _service;
    private readonly ICurrentUserContext _userContext;

    public SolicitacoesDependenteController(ISolicitacaoDependenteService service, ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SolicitacaoDependenteGridRow>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] string? q,
        [FromQuery] SolicitacaoStatus? status,
        [FromQuery(Name = "statuses")] SolicitacaoStatus[]? statuses,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken ct)
    {
        var apenasMeus = !_userContext.IsAdmin;
        var query = new SolicitacaoDependenteListQuery(q, status, statuses, apenasMeus, page, pageSize);
        return Ok(await _service.ListAsync(query, _userContext.FuncionarioId, ct));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(SolicitacaoDependenteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _service.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(SolicitacaoDependenteResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] SolicitacaoDependenteCreateRequest request, CancellationToken ct)
    {
        try
        {
            var created = await _service.CreateAsync(request, _userContext.FuncionarioId, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(SolicitacaoDependenteResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, [FromBody] SolicitacaoDependenteUpdateRequest request, CancellationToken ct)
    {
        try
        {
            var updated = await _service.UpdateAsync(id, request, ct);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/submit")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct)
    {
        try
        {
            var ok = await _service.SubmitAsync(id, ct);
            return ok ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/approve")]
    [ProducesResponseType(typeof(SolicitacaoDependenteResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Approve(Guid id, [FromBody] SolicitacaoDependenteApprovalRequest? request, CancellationToken ct)
    {
        if (!await CanApprove(id, ct)) return Forbid();
        try
        {
            var result = await _service.ApproveAsync(id, request?.Observacao, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/reject")]
    [ProducesResponseType(typeof(SolicitacaoDependenteResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] SolicitacaoDependenteApprovalRequest? request, CancellationToken ct)
    {
        if (!await CanApprove(id, ct)) return Forbid();
        try
        {
            var result = await _service.RejectAsync(id, request?.Observacao, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/request-changes")]
    [ProducesResponseType(typeof(SolicitacaoDependenteResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> RequestChanges(Guid id, [FromBody] SolicitacaoDependenteApprovalRequest? request, CancellationToken ct)
    {
        if (!await CanApprove(id, ct)) return Forbid();
        try
        {
            var result = await _service.RequestChangesAsync(id, request?.Observacao, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/assumir")]
    [ProducesResponseType(typeof(SolicitacaoDependenteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Assumir(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _service.AssumirAsync(id, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        try
        {
            var ok = await _service.DeleteAsync(id, ct);
            return ok ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    private Task<bool> CanApprove(Guid solicitacaoId, CancellationToken ct)
    {
        return Task.FromResult(true);
    }
}
