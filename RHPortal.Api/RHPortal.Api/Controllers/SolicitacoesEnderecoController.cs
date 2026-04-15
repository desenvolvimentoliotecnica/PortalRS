using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.SolicitacoesEndereco;
using RhPortal.Api.Contracts.SolicitacoesEndereco;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Solicitações de alteração de endereço pelo colaborador. Na aprovação, atualiza a Pessoa.
/// </summary>
[ApiController]
[Route("api/colaborador/solicitacoes-endereco")]
public sealed class SolicitacoesEnderecoController : ControllerBase
{
    private readonly ISolicitacaoEnderecoService _service;
    private readonly ICurrentUserContext _userContext;

    public SolicitacoesEnderecoController(ISolicitacaoEnderecoService service, ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SolicitacaoEnderecoGridRow>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] string? q,
        [FromQuery] SolicitacaoStatus? status,
        [FromQuery(Name = "statuses")] SolicitacaoStatus[]? statuses,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken ct)
    {
        var apenasMeus = !_userContext.IsAdmin;
        var query = new SolicitacaoEnderecoListQuery(q, status, statuses, apenasMeus, page, pageSize);
        return Ok(await _service.ListAsync(query, _userContext.FuncionarioId, ct));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(SolicitacaoEnderecoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _service.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(SolicitacaoEnderecoResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] SolicitacaoEnderecoCreateRequest request, CancellationToken ct)
    {
        try
        {
            var created = await _service.CreateAsync(request, _userContext.FuncionarioId, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(SolicitacaoEnderecoResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, [FromBody] SolicitacaoEnderecoUpdateRequest request, CancellationToken ct)
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
    [ProducesResponseType(typeof(SolicitacaoEnderecoResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Approve(Guid id, [FromBody] SolicitacaoEnderecoApprovalRequest? request, CancellationToken ct)
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
    [ProducesResponseType(typeof(SolicitacaoEnderecoResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] SolicitacaoEnderecoApprovalRequest? request, CancellationToken ct)
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
    [ProducesResponseType(typeof(SolicitacaoEnderecoResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> RequestChanges(Guid id, [FromBody] SolicitacaoEnderecoApprovalRequest? request, CancellationToken ct)
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
    [ProducesResponseType(typeof(SolicitacaoEnderecoResponse), StatusCodes.Status200OK)]
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
