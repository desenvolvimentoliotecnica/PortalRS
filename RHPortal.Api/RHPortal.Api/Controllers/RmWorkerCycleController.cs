using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.IntegracaoTotvs;
using RhPortal.Api.Contracts.IntegracaoTotvs;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Intervalo entre ciclos do worker RM (persistido no tenant DB).
/// Chamado pelo <c>Liotecnica.Integration.RM</c> (GET) e pela UI Owner (via rota owner com escopo de tenant).
/// </summary>
[ApiController]
[Route("api/integracao-totvs/rm-worker-cycle")]
[Authorize]
public sealed class RmWorkerCycleController : ControllerBase
{
    private readonly IRmSyncRunService _service;

    public RmWorkerCycleController(IRmSyncRunService service)
    {
        _service = service;
    }

    /// <summary>Retorna intervalo vigente ou cria padrão 5 minutos.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(RmWorkerCycleSettingsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken ct)
        => Ok(await _service.GetWorkerCycleSettingsAsync(ct));
}
