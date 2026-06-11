using RhPortal.Api.Application.RmConfiguracao;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Rm;

/// <summary>
/// Simula criação no RM com código determinístico — adequado a dev/staging sem SQL de escrita.
/// </summary>
public sealed class RmRequisicaoCreateStubClient(ITenantRmConfiguracaoService rmConfiguracaoService) : IRmRequisicaoCreateClient
{
    public async Task<RmCreateRequisicaoOutcome> EnviarOuObterJaCriadoAsync(
        SolicitacaoVaga solicitacao,
        string idempotencyKey,
        string payloadResumo,
        CancellationToken ct)
    {
        _ = payloadResumo;
        var options = await rmConfiguracaoService.GetCreateOptionsAsync(ct);
        if (!string.Equals(options.Mode, "stub", StringComparison.OrdinalIgnoreCase))
            return new RmCreateRequisicaoOutcome(false, false, null, null, "Cliente Stub inválido para o modo configurado.", null);

        if (!string.IsNullOrWhiteSpace(solicitacao.RmRequisicaoCodigo)
            && solicitacao.RmRequisicaoCodigo.StartsWith("STUB-", StringComparison.OrdinalIgnoreCase))
            return new RmCreateRequisicaoOutcome(
                true,
                true,
                solicitacao.RmRequisicaoCodigo,
                solicitacao.RmCodStatus ?? 1,
                null,
                null,
                solicitacao.RmCodColRequisicao,
                solicitacao.RmIdReq);

        var codigo = $"STUB-{solicitacao.Id:N}".ToUpperInvariant();
        if (codigo.Length > 120)
            codigo = codigo[..120];

        return new RmCreateRequisicaoOutcome(
            true,
            false,
            codigo,
            1,
            null,
            null,
            options.CodColRequisicaoDefault,
            Math.Abs(solicitacao.Id.GetHashCode()));
    }
}
