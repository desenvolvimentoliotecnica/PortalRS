using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Candidaturas;
using RhPortal.Api.Contracts.Candidatura;
using RhPortal.Api.Infrastructure.Security;

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

    public CandidaturasController(ICandidaturaService service)
    {
        _service = service;
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
    [ProducesResponseType(typeof(CandidaturaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CandidaturaResponse>> AvancarEtapa(
        Guid id,
        [FromBody] AvancarEtapaRequest request,
        CancellationToken ct)
    {
        try
        {
            var resp = await _service.AvancarEtapaAsync(id, request.NovaEtapa, request.Observacao, ct);
            if (resp is null) return NotFound();
            return Ok(resp);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}
