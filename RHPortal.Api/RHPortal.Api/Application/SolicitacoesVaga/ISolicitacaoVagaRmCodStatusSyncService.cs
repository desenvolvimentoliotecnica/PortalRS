using RhPortal.Api.Contracts.Rm;

namespace RhPortal.Api.Application.SolicitacoesVaga;

public interface ISolicitacaoVagaRmCodStatusSyncService
{
    Task<RmSolicitacaoStatusSyncResponse> RunBatchAsync(RmSolicitacaoStatusSyncRequest request, int? maxPerRunOverride, CancellationToken ct);
}
