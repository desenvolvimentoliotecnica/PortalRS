using RhPortal.Api.Contracts.Rm;

namespace RhPortal.Api.Infrastructure.Rm;

public interface IRmRequisicaoParecerReadService
{
    Task<IReadOnlyList<RmRequisicaoParecerRowDto>> ListAsync(int codColRequisicao, int idReq, CancellationToken ct);
}
