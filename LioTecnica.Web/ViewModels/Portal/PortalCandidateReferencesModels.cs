namespace LioTecnica.Web.ViewModels.Portal;

public sealed record PortalCandidateReferenceDto(
    Guid Id,
    string Nome,
    string? Relacao,
    string? Empresa,
    string? Cargo,
    string? Contato,
    string? Periodo,
    string? Linkedin,
    string? Observacoes,
    bool PodeContatar,
    DateTimeOffset UpdatedAtUtc
);

public sealed record PortalCandidateReferencesResponse(
    IReadOnlyList<PortalCandidateReferenceDto> Items
);

public sealed record PortalCandidateReferenceRequest(
    string Nome,
    string? Relacao,
    string? Empresa,
    string? Cargo,
    string? Contato,
    string? Periodo,
    string? Linkedin,
    string? Observacoes,
    bool PodeContatar
);
