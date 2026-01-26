using System.ComponentModel.DataAnnotations;

namespace LioTecnica.Web.ViewModels.Portal;

public sealed record PortalCandidateLgpdResponse(
    bool ProcessarCandidatura,
    bool PermitirContato,
    bool BancoTalentos,
    int? RetencaoMeses,
    string? Compartilhamento,
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
    string? Compartilhamento,
    bool DadosSensiveis,
    bool Comunicacoes
);

public sealed record PortalCandidateLgpdReceiptResponse(
    [Required] string Html
);
