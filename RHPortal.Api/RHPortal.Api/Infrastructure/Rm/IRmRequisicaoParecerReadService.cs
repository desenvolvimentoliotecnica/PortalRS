using RhPortal.Api.Contracts.Rm;

namespace RhPortal.Api.Infrastructure.Rm;

public interface IRmRequisicaoParecerReadService
{
    /// <summary>
    /// Lista pareceres da requisição RM. Preferência: SQL (VREQ*PARECER); REST só como fallback.
    /// </summary>
    Task<IReadOnlyList<RmRequisicaoParecerRowDto>> ListAsync(
        string tipoRequisicao,
        int codColRequisicao,
        int idReq,
        CancellationToken ct);
}
