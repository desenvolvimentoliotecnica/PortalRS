using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.SolicitacoesDesligamento;
using RhPortal.Api.Contracts.SolicitacoesDesligamento;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Solicitações de desligamento de funcionários (gestor -> aprovação do superior/RH).
/// </summary>
[ApiController]
[Route("api/solicitacoes-desligamento")]
public sealed class SolicitacoesDesligamentoController : ControllerBase
{
    private readonly ISolicitacaoDesligamentoService _service;
    private readonly ICurrentUserContext _userContext;

    public SolicitacoesDesligamentoController(
        ISolicitacaoDesligamentoService service,
        ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    /// <summary>Lista solicitações de desligamento com filtro por perfil.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SolicitacaoDesligamentoGridRow>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] string? q,
        [FromQuery] SolicitacaoStatus? status,
        [FromQuery] bool? apenasMeus,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken ct)
    {
        var isAdmin = _userContext.IsAdmin;
        var effectiveApenasMeus = isAdmin ? (apenasMeus ?? false) : true;

        var query = new SolicitacaoDesligamentoListQuery(q, status, effectiveApenasMeus, page, pageSize);
        return Ok(await _service.ListAsync(query, _userContext.FuncionarioId, ct));
    }

    /// <summary>Retorna uma solicitação por ID.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(SolicitacaoDesligamentoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _service.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>Cria uma nova solicitação de desligamento (rascunho).</summary>
    [HttpPost]
    [ProducesResponseType(typeof(SolicitacaoDesligamentoResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromBody] SolicitacaoDesligamentoCreateRequest request,
        CancellationToken ct)
    {
        try
        {
            var created = await _service.CreateAsync(request, _userContext.FuncionarioId, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Atualiza uma solicitação (somente rascunho ou ajustes necessários).</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(SolicitacaoDesligamentoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(Guid id, [FromBody] SolicitacaoDesligamentoUpdateRequest request, CancellationToken ct)
    {
        try
        {
            var updated = await _service.UpdateAsync(id, request, ct);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Submete a solicitação para aprovação do superior.</summary>
    [HttpPost("{id:guid}/submit")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct)
    {
        try
        {
            var ok = await _service.SubmitAsync(id, ct);
            return ok ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Aprova a solicitação (somente aprovador designado ou Admin).</summary>
    [HttpPost("{id:guid}/approve")]
    [ProducesResponseType(typeof(SolicitacaoDesligamentoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Approve(Guid id, [FromBody] SolicitacaoApprovalRequest? request, CancellationToken ct)
    {
        if (!await CanApprove(id, ct))
            return Forbid();

        try
        {
            var result = await _service.ApproveAsync(id, request?.Observacao, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Reprova a solicitação com observação (somente aprovador designado ou Admin).</summary>
    [HttpPost("{id:guid}/reject")]
    [ProducesResponseType(typeof(SolicitacaoDesligamentoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] SolicitacaoApprovalRequest? request, CancellationToken ct)
    {
        if (!await CanApprove(id, ct))
            return Forbid();

        try
        {
            var result = await _service.RejectAsync(id, request?.Observacao, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Solicita ajustes na solicitação (somente aprovador designado ou Admin).</summary>
    [HttpPost("{id:guid}/request-changes")]
    [ProducesResponseType(typeof(SolicitacaoDesligamentoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RequestChanges(Guid id, [FromBody] SolicitacaoApprovalRequest? request, CancellationToken ct)
    {
        if (!await CanApprove(id, ct))
            return Forbid();

        try
        {
            var result = await _service.RequestChangesAsync(id, request?.Observacao, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Exclui uma solicitação (somente rascunho).</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        try
        {
            var ok = await _service.DeleteAsync(id, ct);
            return ok ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    // ── helpers ──

    /// <summary>
    /// Returns true if the current user is Admin or the designated approver for this solicitação.
    /// </summary>
    private async Task<bool> CanApprove(Guid solicitacaoId, CancellationToken ct)
    {
        if (_userContext.IsAdmin) return true;

        var sol = await _service.GetByIdAsync(solicitacaoId, ct);
        if (sol is null) return true; // will 404 downstream

        var funcId = _userContext.FuncionarioId;

        // Check if current user is Aprovador1 or Aprovador2
        if (funcId.HasValue)
        {
            if (sol.Aprovador1Id.HasValue && sol.Aprovador1Id.Value == funcId.Value)
                return true;
            if (sol.Aprovador2Id.HasValue && sol.Aprovador2Id.Value == funcId.Value)
                return true;
        }

        // Fallback: area-based — user with same area can approve
        if (_userContext.AreaId.HasValue)
        {
            // Desligamento doesn't have its own AreaId, so we check the funcionario's area
            // This is a simplified check — in production you might want to load the funcionario's area
        }

        return false;
    }
}
