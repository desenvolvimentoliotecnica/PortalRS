using RhPortal.Api.Contracts.Rm;

namespace RhPortal.Api.Infrastructure.Rm;

public interface IRmRequisicoesReadService
{
    Task<RmRequisicaoListResponse> ListAsync(RmRequisicaoListQuery query, CancellationToken ct);
}
