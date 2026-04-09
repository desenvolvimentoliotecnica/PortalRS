using RhPortal.Api.Contracts.IntegracaoTotvs;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.IntegracaoTotvs;

public interface IIntegracaoTotvsService
{
    Task<IntegracaoTotvsPainelResponse> ListPainelAsync(IntegracaoTotvsPainelQuery query, CancellationToken ct);
    Task RegistrarResultadoAsync(TipoIntegracao tipo, Guid id, IntegracaoTotvsResultadoRequest request, CancellationToken ct);
    Task RetryAsync(TipoIntegracao tipo, Guid id, CancellationToken ct);
}
