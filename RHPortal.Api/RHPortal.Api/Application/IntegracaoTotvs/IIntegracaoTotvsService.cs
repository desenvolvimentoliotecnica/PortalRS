using RhPortal.Api.Contracts.IntegracaoTotvs;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.IntegracaoTotvs;

public interface IIntegracaoTotvsService
{
    Task<IntegracaoTotvsPainelResponse> ListPainelAsync(IntegracaoTotvsPainelQuery query, CancellationToken ct);
    Task<object?> GetDetalheAsync(TipoIntegracao tipo, Guid id, CancellationToken ct);
    Task RegistrarResultadoAsync(TipoIntegracao tipo, Guid id, IntegracaoTotvsResultadoRequest request, CancellationToken ct);
    Task RetryAsync(TipoIntegracao tipo, Guid id, CancellationToken ct);
    Task<IntegracaoReconciliacaoResponse> ReconciliacaoAsync(int diasMinimos, CancellationToken ct);
    Task<EfetivarManualResponse> EfetivarManualAsync(TipoIntegracao tipo, Guid id, Guid? responsavelId, CancellationToken ct);
}
