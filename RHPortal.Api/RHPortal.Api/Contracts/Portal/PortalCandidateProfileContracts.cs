using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidateProfileResponse(
    Guid Id,
    string Nome,
    string Email,
    string? Fone,
    string? Cidade,
    string? Uf
);

public sealed record PortalCandidateProfileUpdateRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(40)] string Fone,
    [Required, MaxLength(120)] string Cidade,
    [Required, MaxLength(2)] string Uf
);
