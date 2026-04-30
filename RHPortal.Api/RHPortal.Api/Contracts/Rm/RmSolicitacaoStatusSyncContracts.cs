namespace RhPortal.Api.Contracts.Rm;

public sealed record RmSolicitacaoStatusSyncRequest(IReadOnlyList<Guid>? Ids = null);

public sealed record RmSolicitacaoStatusSyncResponse(
    int TotalLidos,
    int Atualizados,
    int Ignorados,
    int Erros,
    string? Mensagem);
