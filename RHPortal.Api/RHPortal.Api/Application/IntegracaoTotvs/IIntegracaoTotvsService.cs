using RhPortal.Api.Application.Common;
using RhPortal.Api.Contracts.IntegracaoTotvs;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.IntegracaoTotvs;

public interface IIntegracaoTotvsService
{
    Task<IntegracaoTotvsPainelResponse> ListPainelAsync(IntegracaoTotvsPainelQuery query, CancellationToken ct);
    Task<object?> GetDetalheAsync(TipoIntegracao tipo, Guid id, CancellationToken ct);
    Task<IReadOnlyList<object>> ListDesligamentosPayloadAsync(SolicitacaoStatus[] statuses, CancellationToken ct);
    Task VoltarPendenteAsync(TipoIntegracao tipo, Guid id, ICurrentUserContext currentUser, CancellationToken ct);
    Task RegistrarResultadoAsync(TipoIntegracao tipo, Guid id, IntegracaoTotvsResultadoRequest request, CancellationToken ct);
    Task RetryAsync(TipoIntegracao tipo, Guid id, CancellationToken ct);
    Task<IntegracaoReconciliacaoResponse> ReconciliacaoAsync(int diasMinimos, CancellationToken ct);
    Task<EfetivarManualResponse> EfetivarManualAsync(TipoIntegracao tipo, Guid id, Guid? responsavelId, CancellationToken ct);
}
