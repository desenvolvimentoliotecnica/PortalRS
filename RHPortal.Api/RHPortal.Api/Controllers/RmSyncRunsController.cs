using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.IntegracaoTotvs;
using RhPortal.Api.Contracts.IntegracaoTotvs;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoints chamados pelo worker <c>Liotecnica.Integration.RM</c> ao redor de cada sync de entidade,
/// para registrar telemetria que alimenta a aba "Sincronização RM" da tela Owner Integração TOTVS.
/// Auth: aceita ApiKey (worker) ou JWT (testes manuais), via esquemas registrados em <c>Program.cs</c>.
/// </summary>
[ApiController]
[Route("api/integracao-totvs/rm-runs")]
[Authorize]
public sealed class RmSyncRunsController : ControllerBase
{
    private readonly IRmSyncRunService _service;

    public RmSyncRunsController(IRmSyncRunService service)
    {
        _service = service;
    }

    /// <summary>Cria um run com status InProgress; o worker grava o Id e usa no PATCH ao terminar.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(RmSyncRunCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Start([FromBody] StartRmSyncRunRequest request, CancellationToken ct)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Entidade))
            return BadRequest(new { message = "Campo 'entidade' é obrigatório." });

        var id = await _service.StartAsync(request, ct);
        return CreatedAtAction(nameof(Start), new { id }, new RmSyncRunCreatedResponse(id));
    }

    /// <summary>Finaliza o run (Sucesso, Falha, FalhaParcial) com counters e watermark capturado.</summary>
    [HttpPatch("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Finish(Guid id, [FromBody] FinishRmSyncRunRequest request, CancellationToken ct)
    {
        try
        {
            await _service.FinishAsync(id, request, ct);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}

/// <summary>
/// Endpoints de watermark para sync incremental por entidade RM
/// (Frente A — RECMODIFIEDON como filtro WHERE no SELECT do CORPORERM).
/// </summary>
[ApiController]
[Route("api/integracao-totvs/rm-checkpoints")]
[Authorize]
public sealed class RmSyncCheckpointsController : ControllerBase
{
    private readonly IRmSyncRunService _service;

    public RmSyncCheckpointsController(IRmSyncRunService service)
    {
        _service = service;
    }

    /// <summary>Lê watermark da entidade. Sempre retorna 200 (registro vazio se nunca rodou).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(RmSyncCheckpointResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get([FromQuery] string entidade, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(entidade))
            return BadRequest(new { message = "Query 'entidade' é obrigatória." });
        return Ok(await _service.GetCheckpointAsync(entidade, ct));
    }

    /// <summary>Persiste novo watermark após sync bem-sucedido. Upsert por (TenantId, Entidade).</summary>
    [HttpPut]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update([FromBody] UpdateRmSyncCheckpointRequest request, CancellationToken ct)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Entidade))
            return BadRequest(new { message = "Campo 'entidade' é obrigatório." });
        await _service.UpdateCheckpointAsync(request, ct);
        return NoContent();
    }

    /// <summary>Reseta watermark da entidade (volta a null) — força full no próximo ciclo.</summary>
    [HttpPost("{entidade}/reset")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Reset(string entidade, CancellationToken ct)
    {
        await _service.ResetCheckpointAsync(entidade, ct);
        return NoContent();
    }

    /// <summary>Reseta TODOS os checkpoints do tenant — usado pelo CLI <c>sync --full</c>.</summary>
    [HttpPost("reset-all")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ResetAll(CancellationToken ct)
    {
        await _service.ResetAllCheckpointsAsync(ct);
        return NoContent();
    }
}
