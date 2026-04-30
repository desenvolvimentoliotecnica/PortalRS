using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.SolicitacoesVaga;
using RhPortal.Api.Contracts.SolicitacoesVaga;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Solicitações de abertura de vaga (gestor → aprovação do superior).
/// </summary>
[ApiController]
[Route("api/solicitacoes-vaga")]
[RequireModule("recrutamento")]
public sealed class SolicitacoesVagaController : ControllerBase
{
    private readonly ISolicitacaoVagaService _service;
    private readonly ICurrentUserContext _userContext;

    public SolicitacoesVagaController(
        ISolicitacaoVagaService service,
        ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    /// <summary>Lista solicitações de vaga com filtro por perfil.</summary>
    /// <remarks>
    /// Admin → vê todas. Gestor → só as próprias (forçado apenasMeus=true).
    /// </remarks>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SolicitacaoVagaGridRow>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] string? q,
        [FromQuery] SolicitacaoStatus? status,
        [FromQuery(Name = "statuses")] SolicitacaoStatus[]? statuses,
        [FromQuery] bool? apenasMeus,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] Guid? vagaId,
        CancellationToken ct)
    {
        var query = new SolicitacaoVagaListQuery(q, status, statuses, apenasMeus, page, pageSize, vagaId);
        return Ok(await _service.ListAsync(query, _userContext.FuncionarioId, ct));
    }

    /// <summary>Retorna uma solicitação por ID.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _service.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>Cria uma nova solicitação de vaga (rascunho).</summary>
    [HttpPost]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromBody] SolicitacaoVagaCreateRequest request,
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
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(Guid id, [FromBody] SolicitacaoVagaUpdateRequest request, CancellationToken ct)
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

    /// <summary>Fluxo aumento de quadro: RH/admin marca início formal da triagem (PendenteTriagem → EmTriagem).</summary>
    [HttpPost("{id:guid}/triagem/iniciar")]
    [RequirePermission("rh.contratacoes.triagem")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> TriagemIniciar(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _service.IniciarTriagemAsync(id, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Fluxo aumento de quadro: triagem devolve ao gestor com observações obrigatórias.</summary>
    [HttpPost("{id:guid}/triagem/devolver")]
    [RequirePermission("rh.contratacoes.triagem")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> TriagemDevolver(Guid id, [FromBody] SolicitacaoVagaTriagemDevolverRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _service.DevolverTriagemAoGestorAsync(id, request.Observacao, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Fluxo aumento de quadro: encaminha para a cadeia de aprovações (EmTriagem → PendenteAprovacao + etapas).</summary>
    [HttpPost("{id:guid}/triagem/encaminhar")]
    [RequirePermission("rh.contratacoes.triagem")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> TriagemEncaminhar(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _service.EncaminharTriagemParaAprovacoesAsync(id, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Fluxo aumento de quadro: reprovação interna na triagem (sem etapas de aprovador).</summary>
    [HttpPost("{id:guid}/triagem/reprovar")]
    [RequirePermission("rh.contratacoes.triagem")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> TriagemReprovar(Guid id, [FromBody] SolicitacaoVagaTriagemReprovarRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _service.TriagemReprovarAsync(id, request.Motivo, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/selecao/iniciar")]
    [RequirePermission("rh.contratacoes.selecao")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SelecaoIniciar(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _service.IniciarProcessoSeletivoAsync(id, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/selecao/suspender")]
    [RequirePermission("rh.contratacoes.selecao")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SelecaoSuspender(Guid id, [FromBody] SolicitacaoVagaApprovalRequest? request, CancellationToken ct)
    {
        try
        {
            var result = await _service.SuspenderSelecaoAsync(id, request?.Observacao, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/selecao/retomar")]
    [RequirePermission("rh.contratacoes.selecao")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SelecaoRetomar(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _service.RetomarSelecaoAsync(id, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/selecao/encerrar-sem-contratacao")]
    [RequirePermission("rh.contratacoes.selecao")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SelecaoEncerrarSemContratacao(Guid id, [FromBody] SolicitacaoVagaSelecaObservacaoRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _service.EncerrarSemContratacaoAsync(id, request.Observacao, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/selecao/contratacao-concluida")]
    [RequirePermission("rh.contratacoes.selecao")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SelecaoContratacaoConcluida(Guid id, [FromBody] SolicitacaoVagaApprovalRequest? request, CancellationToken ct)
    {
        try
        {
            var result = await _service.MarcarContratacaoConcluidaAsync(id, request?.Observacao, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpGet("{id:guid}/indicacoes")]
    [ProducesResponseType(typeof(IReadOnlyList<SolicitacaoVagaIndicacaoDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListIndicacoes(Guid id, CancellationToken ct)
    {
        var items = await _service.ListIndicacoesAsync(id, ct);
        return Ok(items);
    }

    [HttpPost("{id:guid}/indicacoes")]
    [RequirePermission("rh.contratacoes.selecao")]
    [ProducesResponseType(typeof(SolicitacaoVagaIndicacaoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddIndicacao(Guid id, [FromBody] SolicitacaoVagaIndicacaoCreateRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _service.AddIndicacaoAsync(id, request, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}/indicacoes/{indicacaoId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RemoveIndicacao(Guid id, Guid indicacaoId, CancellationToken ct)
    {
        try
        {
            var ok = await _service.RemoveIndicacaoAsync(id, indicacaoId, ct);
            return ok ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Aprova a solicitação (somente aprovador designado ou Admin).</summary>
    [HttpPost("{id:guid}/approve")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Approve(Guid id, [FromBody] SolicitacaoVagaApprovalRequest? request, CancellationToken ct)
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

    /// <summary>Assume a solicitação de uma fila de perfil para o usuário logado.</summary>
    [HttpPost("{id:guid}/assumir")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
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
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>RH/Admin efetiva a requisição aprovada, enviando ao TOTVS ERP (status EmIntegracao).</summary>
    [HttpPost("{id:guid}/efetivar")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Efetivar(Guid id, CancellationToken ct)
    {
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

    /// <summary>Reprova a solicitação com observação (somente aprovador designado ou Admin).</summary>
    [HttpPost("{id:guid}/reject")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] SolicitacaoVagaApprovalRequest? request, CancellationToken ct)
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
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RequestChanges(Guid id, [FromBody] SolicitacaoVagaApprovalRequest? request, CancellationToken ct)
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

    /// <summary>Amarra manualmente um candidato contratado a esta solicitação de vaga (fora do fluxo automático de pré-admissão).</summary>
    [HttpPut("{id:guid}/vincular-candidato")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> VincularCandidato(Guid id, [FromBody] VincularCandidatoRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _service.VincularCandidatoContratadoAsync(id, request.CandidatoId, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Cancela uma solicitação (somente pelo solicitante, enquanto não aprovada).</summary>
    [HttpPost("{id:guid}/cancel")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
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

    [HttpPost("{id:guid}/copy")]
    [ProducesResponseType(typeof(SolicitacaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Copy(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _service.CopyAsync(id, _userContext.FuncionarioId, ct);
            return Ok(result);
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

    /// <summary>Debug — mostra estado da etapa pendente e resolução de nome.</summary>
    [HttpGet("{id:guid}/debug-etapa")]
    public async Task<IActionResult> DebugEtapa(Guid id, [FromServices] AppDbContext db, CancellationToken ct)
    {
        var etapa = await db.Set<SolicitacaoAprovacaoEtapa>()
            .AsNoTracking()
            .Where(e => e.SolicitacaoId == id && e.TipoFluxo == TipoFluxoAprovacao.RequisicaoPessoal)
            .OrderBy(e => e.Ordem)
            .ToListAsync(ct);

        var result = new List<object>();
        foreach (var e in etapa)
        {
            object? aprovadorUser = null;
            if (e.AprovadorId.HasValue)
            {
                aprovadorUser = await db.Set<ApplicationUser>()
                    .AsNoTracking()
                    .Where(u => u.FuncionarioId == e.AprovadorId)
                    .Select(u => new { u.Id, u.UserName, u.FullName, u.FuncionarioId, u.IsActive })
                    .FirstOrDefaultAsync(ct);
            }

            object? assumedUser = null;
            if (e.AssumedByUserId.HasValue)
            {
                assumedUser = await db.Set<ApplicationUser>()
                    .AsNoTracking()
                    .IgnoreQueryFilters()
                    .Where(u => u.Id == e.AssumedByUserId.Value)
                    .Select(u => new { u.Id, u.UserName, u.FullName, u.FuncionarioId, u.IsActive, u.TenantId })
                    .FirstOrDefaultAsync(ct);
            }

            result.Add(new
            {
                e.Ordem, e.Label, e.Status,
                e.AprovadorId, e.RoleFilaId,
                e.AssumedByUserId, e.Observacao,
                aprovadorUser,
                assumedUser,
            });
        }

        return Ok(new
        {
            currentUserId = _userContext.UserId,
            currentFuncionarioId = _userContext.FuncionarioId,
            isAdmin = _userContext.IsAdmin,
            etapas = result,
        });
    }

    // ── helpers ──

    private Task<bool> CanApprove(Guid solicitacaoId, CancellationToken ct)
    {
        // Delegação da autorização fina (Role, Gestor Direto, etc.) para o Serviço.
        return Task.FromResult(true);
    }
}
