using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Candidaturas;
using RhPortal.Api.Contracts.Candidatura;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Candidaturas (admin/RH): kanban por EtapaMacroCandidatura, listagem por candidato e avanço de etapa.
/// </summary>
[ApiController]
[Route("api/candidaturas")]
[RequireModule("recrutamento")]
public sealed class CandidaturasController : ControllerBase
{
    private readonly ICandidaturaService _service;
    private readonly ICurrentUserContext _userContext;

    public CandidaturasController(ICandidaturaService service, ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    /// <summary>
    /// Retorna as candidaturas agrupadas em colunas por EtapaMacroCandidatura
    /// (Aplicada, EmTriagem, Entrevista, Teste, Proposta, Contratado, Recusado, Desistiu).
    /// </summary>
    [HttpGet("kanban")]
    [ProducesResponseType(typeof(KanbanCandidaturasResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<KanbanCandidaturasResponse>> Kanban(
        [FromQuery] Guid? vagaId,
        CancellationToken ct)
    {
        var resp = await _service.ListarKanbanAsync(vagaId, ct);
        return Ok(resp);
    }

    /// <summary>
    /// Retorna somente vagas relevantes para o filtro do Kanban: vagas com candidaturas
    /// visíveis no Kanban e, para analista RH, vagas atribuídas a ele mesmo sem candidatura.
    /// Gestor: vagas ligadas às solicitações que ele abriu.
    /// </summary>
    [HttpGet("kanban/vagas")]
    [ProducesResponseType(typeof(IReadOnlyList<KanbanVagaFiltroItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<KanbanVagaFiltroItem>>> KanbanVagas(CancellationToken ct)
    {
        var resp = await _service.ListarVagasKanbanAsync(ct);
        return Ok(resp);
    }

    /// <summary>Lista as candidaturas de um candidato (com histórico completo).</summary>
    [HttpGet("candidato/{candidatoId:guid}")]
    [ProducesResponseType(typeof(IReadOnlyList<CandidaturaResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CandidaturaResponse>>> ListarDoCandidato(
        Guid candidatoId,
        CancellationToken ct)
    {
        var list = await _service.ListarDoCandidatoAsync(candidatoId, ct);
        return Ok(list);
    }

    /// <summary>Avança (ou retrocede) a etapa de uma candidatura — registra histórico e dispara notificação.</summary>
    [HttpPost("{id:guid}/avancar-etapa")]
    [ProducesResponseType(typeof(AvancarEtapaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AvancarEtapaResponse>> AvancarEtapa(
        Guid id,
        [FromBody] AvancarEtapaRequest request,
        CancellationToken ct)
    {
        if (KanbanSomenteLeitura()) return Forbid();

        try
        {
            var resp = await _service.AvancarEtapaAsync(
                id,
                request.NovaEtapa,
                request.Observacao,
                request.Entrevista,
                request.Notificar,
                ct,
                request.EmailTemplateCode,
                request.EmailSubjectOverride,
                request.EmailBodyHtmlOverride,
                request.NotificarGestor,
                request.LinkAvaliacao);
            if (resp is null) return NotFound();
            return Ok(resp);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Registra uma observação na candidatura sem alterar a etapa atual.</summary>
    [HttpPost("{id:guid}/observacoes")]
    [ProducesResponseType(typeof(CandidaturaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CandidaturaResponse>> RegistrarObservacao(
        Guid id,
        [FromBody] RegistrarObservacaoCandidaturaRequest request,
        CancellationToken ct)
    {
        if (KanbanSomenteLeitura()) return Forbid();

        try
        {
            var resp = await _service.RegistrarObservacaoAsync(id, request.Observacao, ct, request.NotificarGestor);
            if (resp is null) return NotFound();
            return Ok(resp);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Sessão 31.8 (FASE 3.A) — Funil de conversão das candidaturas.
    /// Filtros opcionais: vaga e período de aplicação.
    /// Retorna total por etapa do funil cumulativo + taxa de conversão para a próxima.
    /// </summary>
    [HttpGet("funil")]
    [ProducesResponseType(typeof(FunilCandidaturasResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<FunilCandidaturasResponse>> Funil(
        [FromQuery] Guid? vagaId,
        [FromQuery] DateTimeOffset? inicioUtc,
        [FromQuery] DateTimeOffset? fimUtc,
        CancellationToken ct)
    {
        var resp = await _service.FunilConversaoAsync(vagaId, inicioUtc, fimUtc, ct);
        return Ok(resp);
    }

    /// <summary>
    /// Sessão 31.8 (FASE 3.B) — Avança N candidaturas de etapa em massa.
    /// Falha em uma não bloqueia as outras. Máximo 200 por requisição.
    /// </summary>
    [HttpPost("bulk-avancar-etapa")]
    [ProducesResponseType(typeof(BulkAvancarEtapaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<BulkAvancarEtapaResponse>> BulkAvancarEtapa(
        [FromBody] BulkAvancarEtapaRequest request,
        CancellationToken ct)
    {
        if (KanbanSomenteLeitura()) return Forbid();

        try
        {
            var resp = await _service.AvancarEtapaEmMassaAsync(request, ct);
            return Ok(resp);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private bool KanbanSomenteLeitura() =>
        _userContext.IsInRole("Gestor") || _userContext.IsReadOnly;
}
