using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidateLgpdResponse(
    bool ProcessarCandidatura,
    bool PermitirContato,
    bool BancoTalentos,
    int? RetencaoMeses,
    LgpdSharingScope? Compartilhamento,
    bool DadosSensiveis,
    bool Comunicacoes,
    DateTimeOffset? ConsentidoEmUtc,
    DateTimeOffset? RevogadoEmUtc,
    DateTimeOffset? UpdatedAtUtc
);

public sealed record PortalCandidateLgpdRequest(
    bool ProcessarCandidatura,
    bool PermitirContato,
    bool BancoTalentos,
    int? RetencaoMeses,
    LgpdSharingScope? Compartilhamento,
    bool DadosSensiveis,
    bool Comunicacoes
);

public sealed record PortalCandidateLgpdReceiptResponse(
    string Html
);
