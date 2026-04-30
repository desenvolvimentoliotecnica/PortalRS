using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Rm;

/// <summary>
/// Cliente de criação da requisição no RM (implementação real substitui Stub em produção).
/// </summary>
public interface IRmRequisicaoCreateClient
{
    /// <param name="payloadResumo">JSON ou texto resumido para auditoria (sem PII completo).</param>
    Task<RmCreateRequisicaoOutcome> EnviarOuObterJaCriadoAsync(
        SolicitacaoVaga solicitacao,
        string idempotencyKey,
        string payloadResumo,
        CancellationToken ct);
}
