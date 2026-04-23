using System.Text;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.SolicitacoesPagamentoExtra;
using RhPortal.Api.Contracts.SolicitacoesPagamentoExtra;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Solicitacoes de pagamento extra (bonus, comissao, PLR, etc.). Aprovacao: GestorDireto -> HR.
/// </summary>
[ApiController]
[Route("api/colaborador/solicitacoes-pagamento-extra")]
public sealed class SolicitacoesPagamentoExtraController : ControllerBase
{
    private readonly ISolicitacaoPagamentoExtraService _service;
    private readonly ICurrentUserContext _userContext;

    public SolicitacoesPagamentoExtraController(ISolicitacaoPagamentoExtraService service, ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SolicitacaoPagamentoExtraGridRow>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] string? q,
        [FromQuery] SolicitacaoStatus? status,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken ct)
    {
        var apenasMeus = !_userContext.IsAdmin;
        var query = new SolicitacaoPagamentoExtraListQuery(q, status, apenasMeus, page, pageSize);
        return Ok(await _service.ListAsync(query, _userContext.FuncionarioId, ct));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(SolicitacaoPagamentoExtraResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _service.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(SolicitacaoPagamentoExtraResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] SolicitacaoPagamentoExtraCreateRequest request, CancellationToken ct)
    {
        try
        {
            var created = await _service.CreateAsync(request, _userContext.FuncionarioId, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(SolicitacaoPagamentoExtraResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(Guid id, [FromBody] SolicitacaoPagamentoExtraUpdateRequest request, CancellationToken ct)
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
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
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
    [ProducesResponseType(typeof(SolicitacaoPagamentoExtraResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Approve(Guid id, [FromBody] SolicitacaoPagamentoExtraApprovalRequest? request, CancellationToken ct)
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
    [ProducesResponseType(typeof(SolicitacaoPagamentoExtraResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] SolicitacaoPagamentoExtraApprovalRequest? request, CancellationToken ct)
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
    [ProducesResponseType(typeof(SolicitacaoPagamentoExtraResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> RequestChanges(Guid id, [FromBody] SolicitacaoPagamentoExtraApprovalRequest? request, CancellationToken ct)
    {
        if (!await CanApprove(id, ct)) return Forbid();
        try
        {
            var result = await _service.RequestChangesAsync(id, request?.Observacao, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

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
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export(
        [FromQuery] string? q,
        [FromQuery] SolicitacaoStatus? status,
        CancellationToken ct)
    {
        var apenasMeus = !_userContext.IsAdmin;
        var query = new SolicitacaoPagamentoExtraListQuery(q, status, apenasMeus, null, null);
        var rows = await _service.ListAsync(query, _userContext.FuncionarioId, ct);
        var csv = BuildCsv(rows);
        return File(Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", "pagamento-extra.csv");
    }

    private static string BuildCsv(IReadOnlyList<SolicitacaoPagamentoExtraGridRow> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Solicitante;Beneficiário;Tipo;Valor;Data Pgto;Status");
        foreach (var r in rows)
            sb.AppendLine($"{r.SolicitanteNome};{r.FuncionarioNome};{r.TipoPagamentoExtra};{r.Valor:F2};{r.DataPagamento:dd/MM/yyyy};{r.Status}");
        return sb.ToString();
    }

    private async Task<bool> CanApprove(Guid solicitacaoId, CancellationToken ct)
    {
        if (_userContext.IsAdmin) return true;
        var sol = await _service.GetByIdAsync(solicitacaoId, ct);
        if (sol is null) return true;
        var funcId = _userContext.FuncionarioId;
        if (funcId.HasValue)
        {
            if (sol.Aprovador1Id.HasValue && sol.Aprovador1Id.Value == funcId.Value) return true;
            if (sol.Aprovador2Id.HasValue && sol.Aprovador2Id.Value == funcId.Value) return true;
        }
        return false;
    }
}
