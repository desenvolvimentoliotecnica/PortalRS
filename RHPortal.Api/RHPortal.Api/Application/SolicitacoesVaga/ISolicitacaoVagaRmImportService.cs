using RhPortal.Api.Contracts.Rm;

namespace RhPortal.Api.Application.SolicitacoesVaga;

public interface ISolicitacaoVagaRmImportService
{
    Task<RmRequisicaoImportResponse> ImportarAprovadasAsync(RmRequisicaoImportRequest request, CancellationToken ct);
}
