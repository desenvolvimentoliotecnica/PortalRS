using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.RmConfiguracao;
using RhPortal.Api.Application.SolicitacoesVaga;
using RhPortal.Api.Contracts.Rm;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

/// <summary>Dispara sincronização CODSTATUS RM → requisição de pessoal (tenant atual).</summary>
[ApiController]
[RequirePermission("access.manage")]
[Route("api/rm/solicitacao-vaga")]
public sealed class RmSolicitacaoStatusSyncController : ControllerBase
{
    private readonly ISolicitacaoVagaRmCodStatusSyncService _sync;
    private readonly ISolicitacaoVagaRmImportService _import;
    private readonly ITenantRmConfiguracaoService _rmConfiguracaoService;

    public RmSolicitacaoStatusSyncController(
        ISolicitacaoVagaRmCodStatusSyncService sync,
        ISolicitacaoVagaRmImportService import,
        ITenantRmConfiguracaoService rmConfiguracaoService)
    {
        _sync = sync;
        _import = import;
        _rmConfiguracaoService = rmConfiguracaoService;
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
        var options = await _rmConfiguracaoService.GetStatusSyncOptionsAsync(ct);
        var max = request.Ids is { Count: > 0 } ? (int?)null : options.MaxPerRun;
        var result = await _sync.RunBatchAsync(request, max, ct);
        return Ok(result);
    }

    /// <summary>
    /// Importa requisições aprovadas no RM para o Portal, criando a solicitação rastreável e a vaga rascunho.
    /// Só executa quando a flag RequisicoesVagaOrigemRm está ativa no tenant.
    /// </summary>
    [HttpPost("importar-aprovadas")]
    [ProducesResponseType(typeof(RmRequisicaoImportResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<RmRequisicaoImportResponse>> ImportarAprovadas(
        [FromBody] RmRequisicaoImportRequest? request,
        CancellationToken ct)
    {
        request ??= new RmRequisicaoImportRequest();
        var result = await _import.ImportarAprovadasAsync(request, ct);
        return Ok(result);
    }
}
