namespace RhPortal.Api.Contracts.TenantOperationalReset;

public sealed record OperationalResetPreviewResponse(
    string TenantId,
    bool Allowed,
    string Environment,
    OperationalResetCountsDto WillRemove,
    OperationalResetCountsDto WillPreserve,
    IReadOnlyList<OperationalResetScopeItemDto> RemoveScope,
    IReadOnlyList<OperationalResetScopeItemDto> PreserveScope);

public sealed record OperationalResetCountsDto(
    int Candidatos,
    int Talentos,
    int Candidaturas,
    int PreAdmissoes,
    int VagasTeste,
    int SolicitacoesTeste,
    int ProcessoSeletivoRegistros,
    int VagasRm,
    int SolicitacoesRm);

public sealed record OperationalResetScopeItemDto(
    string Label,
    string Description,
    int Count);

public sealed record OperationalResetExecuteRequest(string? ConnectionId);

public sealed record OperationalResetExecuteResponse(
    bool Ok,
    string Message,
    OperationalResetCountsDto Removed);

public sealed record OperationalResetStepDto(
    string Stage,
    string Label,
    int Order,
    string Status);
