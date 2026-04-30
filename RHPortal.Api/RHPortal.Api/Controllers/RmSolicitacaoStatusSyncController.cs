using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RhPortal.Api.Application.SolicitacoesVaga;
using RhPortal.Api.Contracts.Rm;
using RhPortal.Api.Infrastructure.Rm;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

/// <summary>Dispara sincronização CODSTATUS RM → requisição de pessoal (tenant atual).</summary>
[ApiController]
[RequirePermission("access.manage")]
[Route("api/rm/solicitacao-vaga")]
public sealed class RmSolicitacaoStatusSyncController : ControllerBase
{
    private readonly ISolicitacaoVagaRmCodStatusSyncService _sync;
    private readonly RmSolicitacaoStatusSyncOptions _opts;

    public RmSolicitacaoStatusSyncController(
        ISolicitacaoVagaRmCodStatusSyncService sync,
        IOptions<RmSolicitacaoStatusSyncOptions> opts)
    {
        _sync = sync;
        _opts = opts.Value;
    }

    /// <summary>
    /// Sincroniza em lote. Sem <c>ids</c>, processa até <c>RmSolicitacaoStatusSync:MaxPerRun</c> registros mais recentemente atualizados.
    /// </summary>
    [HttpPost("codstatus-sync")]
    [ProducesResponseType(typeof(RmSolicitacaoStatusSyncResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<RmSolicitacaoStatusSyncResponse>> SyncCodStatus(
        [FromBody] RmSolicitacaoStatusSyncRequest? request,
        CancellationToken ct)
    {
        request ??= new RmSolicitacaoStatusSyncRequest();
        var max = request.Ids is { Count: > 0 } ? (int?)null : _opts.MaxPerRun;
        var result = await _sync.RunBatchAsync(request, max, ct);
        return Ok(result);
    }
}
