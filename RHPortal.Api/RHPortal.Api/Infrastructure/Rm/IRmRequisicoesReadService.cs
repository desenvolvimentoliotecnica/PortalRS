using RhPortal.Api.Contracts.Rm;

namespace RhPortal.Api.Infrastructure.Rm;

public interface IRmRequisicoesReadService
{
    Task<RmRequisicaoListResponse> ListAsync(RmRequisicaoListQuery query, CancellationToken ct);

    /// <summary>
    /// Lê CODSTATUS/descrição no RM pelo código portal (<c>TIPO|CODCOL|IDREQ</c>).
    /// Retorna null se código STUB, parse inválido ou linha não encontrada.
    /// </summary>
    Task<RmRequisicaoCodStatusSnapshot?> TryGetCodStatusByPortalCodigoAsync(string rmRequisicaoCodigo, CancellationToken ct);
}
