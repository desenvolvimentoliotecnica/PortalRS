namespace RhPortal.Api.Contracts.Aprovacoes;

public record PendingItemResponse(
    Guid SolicitacaoId,
    string TipoFluxo,
    string TipoLabel,
    string Titulo,
    string? SolicitanteNome,
    DateTimeOffset DataCriacao,
    string StatusLabel,
    string? EtapaLabel,
    string? EtapaPendenteCom,
    bool EtapaPendenteIsQueue,
    Guid? EtapaPendenteAprovadorId,
    Guid? EtapaPendenteAssumedByUserId,
    bool EtapaPendenteCanAssume,
    string? Link
);
