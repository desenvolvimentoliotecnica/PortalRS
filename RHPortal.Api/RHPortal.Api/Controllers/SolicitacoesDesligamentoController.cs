using System.Text;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Cartas;
using RhPortal.Api.Application.IntegracaoTotvs;
using RhPortal.Api.Application.SolicitacoesDesligamento;
using RhPortal.Api.Contracts.SolicitacoesDesligamento;
using RhPortal.Api.Contracts.SolicitacoesPromocao;
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
    private readonly IIntegracaoTotvsService _integracaoService;
    private readonly ICurrentUserContext _userContext;
    private readonly ICartaService _cartaService;

    public SolicitacoesDesligamentoController(
        ISolicitacaoDesligamentoService service,
        IIntegracaoTotvsService integracaoService,
        ICurrentUserContext userContext,
        ICartaService cartaService)
    {
        _service = service;
        _integracaoService = integracaoService;
        _userContext = userContext;
        _cartaService = cartaService;
    }

    /// <summary>Lista solicitações de desligamento com filtro por perfil.</summary>
    /// <remarks>
    /// Quando <c>statuses</c> contém apenas <c>EmIntegracao</c> (7) e/ou <c>Concluida</c> (8),
    /// retorna o payload completo de integração TOTVS em vez do grid simplificado.
    /// </remarks>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SolicitacaoDesligamentoGridRow>), StatusCodes.Status200OK)]
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
        var integrationStatuses = new[] { SolicitacaoStatus.EmIntegracao, SolicitacaoStatus.Concluida };
        var requestedStatuses = statuses ?? (status.HasValue ? [status.Value] : []);

        if (requestedStatuses.Length > 0 && requestedStatuses.All(s => integrationStatuses.Contains(s)))
            return Ok(await _integracaoService.ListDesligamentosPayloadAsync(requestedStatuses, ct));

        var canViewAll = _userContext.IsAdmin || _userContext.IsRH;
        var effectiveApenasMeus = canViewAll ? (apenasMeus ?? false) : true;

        var query = new SolicitacaoDesligamentoListQuery(q, status, statuses, effectiveApenasMeus, areaId, page, pageSize);
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
    [HttpPost("{id:guid}/assumir")]
    [ProducesResponseType(typeof(SolicitacaoDesligamentoResponse), StatusCodes.Status200OK)]
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
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/cancel")]
    [ProducesResponseType(typeof(SolicitacaoDesligamentoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _service.CancelAsync(id, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Efetiva o desligamento aprovado — move para Em Integração e envia ao painel TOTVS.</summary>
    [HttpPost("{id:guid}/efetivar")]
    [ProducesResponseType(typeof(SolicitacaoDesligamentoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Efetivar(Guid id, CancellationToken ct)
    {
        if (!_userContext.IsAdmin && !_userContext.IsRH)
            return Forbid();

        try
        {
            var result = await _service.EfetivarAsync(id, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Datasul confirma o resultado da integração do desligamento (sucesso ou erro).</summary>
    [HttpPost("{id:guid}/confirmar-integracao")]
    [ProducesResponseType(typeof(SolicitacaoDesligamentoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ConfirmarIntegracao(
        Guid id, [FromBody] ConfirmarIntegracaoMovimentacaoRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _service.ConfirmarIntegracaoAsync(id, request.Resultado, request.Mensagem, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/copy")]
    [ProducesResponseType(typeof(SolicitacaoDesligamentoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Copy(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _service.CopyAsync(id, ct);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Gera carta de desligamento em DOCX e retorna URL presigned S3 (24h).</summary>
    [HttpPost("{id:guid}/carta")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GerarCarta(Guid id, CancellationToken ct)
    {
        try
        {
            var url = await _cartaService.GerarCartaDesligamentoAsync(id, ct);
            return Ok(new { url });
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>Exporta lista de desligamentos em CSV.</summary>
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
        var query = new SolicitacaoDesligamentoListQuery(q, status, null, effectiveApenasMeus, areaId, null, null);
        var rows = await _service.ListAsync(query, _userContext.FuncionarioId, ct);
        var csv = BuildCsv(rows);
        return File(Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", "desligamentos.csv");
    }

    // ── helpers ──

    /// <summary>
    /// Pre-authorization check: returns true if the current user is Admin or appears to be an approver.
    /// The service's ApproveAsync/RejectAsync performs the authoritative check via CanApproveStepAsync.
    /// </summary>
    private async Task<bool> CanApprove(Guid solicitacaoId, CancellationToken ct)
    {
        if (_userContext.IsAdmin) return true;

        var sol = await _service.GetByIdAsync(solicitacaoId, ct);
        if (sol is null) return true; // will 404 downstream

        // Find first pending etapa
        var pendingEtapa = sol.Etapas?.FirstOrDefault(e => e.Status == "Pendente");
        if (pendingEtapa is null) return false;

        if (pendingEtapa.RoleFilaId.HasValue)
        {
            // Role queue: return true here, the service will do the authoritative check
            return true;
        }

        return pendingEtapa.AprovadorId.HasValue && pendingEtapa.AprovadorId == _userContext.FuncionarioId;
    }

    private static string BuildCsv(IReadOnlyList<SolicitacaoDesligamentoGridRow> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Funcionário;Tipo;Data Desligamento;Status;Solicitante;Data Criação");
        foreach (var r in rows)
            sb.AppendLine($"{r.FuncionarioNome};{r.TipoDesligamento};{r.DataDesligamento:dd/MM/yyyy};{r.Status};{r.SolicitanteNome};{r.CreatedAtUtc:dd/MM/yyyy}");
        return sb.ToString();
    }
}
