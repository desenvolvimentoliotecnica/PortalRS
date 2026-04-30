namespace RhPortal.Api.Application.SolicitacoesVaga;

/// <summary>
/// Cria ou confirma a requisição de pessoal no RM após efetivar no portal (Fase 3).
/// Idempotente quando integração já concluiu com sucesso e há código RM.
/// </summary>
public interface ISolicitacaoVagaRmIntegracaoService
{
    Task ExecutarCriacaoRequisicaoRmAsync(Guid solicitacaoVagaId, CancellationToken ct);
}
