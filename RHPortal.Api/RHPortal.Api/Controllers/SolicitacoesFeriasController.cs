using System.Text;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Cartas;
using RhPortal.Api.Application.SolicitacoesFerias;
using RhPortal.Api.Contracts.SolicitacoesFerias;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Solicitações de férias pelo próprio colaborador. Aprovação: GestorDireto → HR.
/// </summary>
[ApiController]
[Route("api/colaborador/solicitacoes-ferias")]
public sealed class SolicitacoesFeriasController : ControllerBase
{
    private readonly ISolicitacaoFeriasService _service;
    private readonly ICurrentUserContext _userContext;
    private readonly ICartaService _cartaService;

    public SolicitacoesFeriasController(
        ISolicitacaoFeriasService service,
        ICurrentUserContext userContext,
        ICartaService cartaService)
    {
        _service = service;
        _userContext = userContext;
        _cartaService = cartaService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SolicitacaoFeriasGridRow>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] string? q,
        [FromQuery] SolicitacaoStatus? status,
        [FromQuery(Name = "statuses")] SolicitacaoStatus[]? statuses,
        [FromQuery] bool? apenasMeus,
        [FromQuery] Guid? areaId,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken ct)
    {
        var canViewAll = _userContext.IsAdmin || _userContext.IsRH;
        var effectiveApenasMeus = canViewAll ? (apenasMeus ?? false) : true;
        var query = new SolicitacaoFeriasListQuery(q, status, statuses, effectiveApenasMeus, areaId, page, pageSize);
        return Ok(await _service.ListAsync(query, _userContext.FuncionarioId, ct));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(SolicitacaoFeriasResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _service.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(typeof(SolicitacaoFeriasResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] SolicitacaoFeriasCreateRequest request, CancellationToken ct)
    {
        try
        {
            var created = await _service.CreateAsync(request, request.FuncionarioId ?? _userContext.FuncionarioId, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(SolicitacaoFeriasResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(Guid id, [FromBody] SolicitacaoFeriasUpdateRequest request, CancellationToken ct)
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
    [ProducesResponseType(typeof(SolicitacaoFeriasResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Approve(Guid id, [FromBody] SolicitacaoFeriasApprovalRequest? request, CancellationToken ct)
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
    [ProducesResponseType(typeof(SolicitacaoFeriasResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] SolicitacaoFeriasApprovalRequest? request, CancellationToken ct)
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
    [ProducesResponseType(typeof(SolicitacaoFeriasResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> RequestChanges(Guid id, [FromBody] SolicitacaoFeriasApprovalRequest? request, CancellationToken ct)
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
    [ProducesResponseType(typeof(SolicitacaoFeriasResponse), StatusCodes.Status200OK)]
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

    /// <summary>Gera carta de autorização de férias em DOCX e retorna URL presigned S3 (24h).</summary>
    [HttpPost("{id:guid}/carta")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GerarCarta(Guid id, CancellationToken ct)
    {
        try
        {
            var url = await _cartaService.GerarCartaFeriasAsync(id, ct);
            return Ok(new { url });
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>Exporta lista de férias em CSV.</summary>
    [HttpGet("export")]
    public async Task<IActionResult> Export(
        [FromQuery] string? q,
        [FromQuery] SolicitacaoStatus? status,
        [FromQuery] bool? apenasMeus,
        [FromQuery] Guid? areaId,
        CancellationToken ct)
    {
        var canViewAll = _userContext.IsAdmin || _userContext.IsRH;
        var effectiveApenasMeus = canViewAll ? (apenasMeus ?? false) : true;
        var query = new SolicitacaoFeriasListQuery(q, status, null, effectiveApenasMeus, areaId, null, null);
        var rows = await _service.ListAsync(query, _userContext.FuncionarioId, ct);
        var csv = BuildCsv(rows);
        return File(Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", "ferias.csv");
    }

    private Task<bool> CanApprove(Guid solicitacaoId, CancellationToken ct)
    {
        return Task.FromResult(true);
    }

    private static string BuildCsv(IReadOnlyList<SolicitacaoFeriasGridRow> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Solicitante;Data Início;Data Fim;Dias;Abono Pecuniário;Status;Data Criação");
        foreach (var r in rows)
            sb.AppendLine($"{r.SolicitanteNome};{r.DataInicio:dd/MM/yyyy};{r.DataFim:dd/MM/yyyy};{r.QtdDias};{(r.AbonoPecuniario ? "Sim" : "Não")};{r.Status};{r.CreatedAtUtc:dd/MM/yyyy}");
        return sb.ToString();
    }
}
