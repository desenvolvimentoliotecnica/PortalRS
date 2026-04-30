using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Rm;

/// <summary>Criação RM desligada — retorna falha até configurar cliente real.</summary>
public sealed class RmRequisicaoCreateDisabledClient : IRmRequisicaoCreateClient
{
    public Task<RmCreateRequisicaoOutcome> EnviarOuObterJaCriadoAsync(
        SolicitacaoVaga solicitacao,
        string idempotencyKey,
        string payloadResumo,
        CancellationToken ct)
    {
        _ = solicitacao;
        _ = idempotencyKey;
        _ = payloadResumo;
        return Task.FromResult(new RmCreateRequisicaoOutcome(
            false, false, null, null,
            "Criação de requisição no RM desabilitada (RmRequisicaoCreate:Mode=disabled). Configure stub ou integração real.",
            503));
    }
}
