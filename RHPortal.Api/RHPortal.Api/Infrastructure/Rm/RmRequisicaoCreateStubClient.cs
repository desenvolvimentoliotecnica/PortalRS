using Microsoft.Extensions.Options;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Rm;

/// <summary>
/// Simula criação no RM com código determinístico — adequado a dev/staging sem SQL de escrita.
/// </summary>
public sealed class RmRequisicaoCreateStubClient(IOptions<RmRequisicaoCreateOptions> options) : IRmRequisicaoCreateClient
{
    private readonly RmRequisicaoCreateOptions _options = options.Value;

    public Task<RmCreateRequisicaoOutcome> EnviarOuObterJaCriadoAsync(
        SolicitacaoVaga solicitacao,
        string idempotencyKey,
        string payloadResumo,
        CancellationToken ct)
    {
        _ = payloadResumo;
        if (!string.Equals(_options.Mode, "stub", StringComparison.OrdinalIgnoreCase))
            return Task.FromResult(new RmCreateRequisicaoOutcome(false, false, null, null, "Cliente Stub inválido para o modo configurado.", null));

        if (!string.IsNullOrWhiteSpace(solicitacao.RmRequisicaoCodigo)
            && solicitacao.RmRequisicaoCodigo.StartsWith("STUB-", StringComparison.OrdinalIgnoreCase))
            return Task.FromResult(new RmCreateRequisicaoOutcome(true, true, solicitacao.RmRequisicaoCodigo, solicitacao.RmCodStatus ?? 1, null, null));

        var codigo = $"STUB-{solicitacao.Id:N}".ToUpperInvariant();
        if (codigo.Length > 120)
            codigo = codigo[..120];

        return Task.FromResult(new RmCreateRequisicaoOutcome(true, false, codigo, 1, null, null));
    }
}
