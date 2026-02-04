using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidateDocumentoSummary(
    Guid Id,
    string NomeArquivo,
    DateTimeOffset CreatedAtUtc
);

public sealed record PortalCandidateProfileResponse(
    Guid Id,
    string Nome,
    string Email,
    string? Fone,
    string? Cidade,
    string? Uf,
    string? LinkedinUrl,
    string? ResumoProfissional,
    string? AvatarUrl,
    PortalCandidateDocumentoSummary? Curriculo
);

public sealed record PortalCandidateProfileUpdateRequest(
    [Required, MaxLength(160)] string Nome,
    [Required, MaxLength(40)] string Fone,
    [Required, MaxLength(120)] string Cidade,
    [Required, MaxLength(2)] string Uf,
    [MaxLength(260)] string? LinkedinUrl,
    [MaxLength(2000)] string? ResumoProfissional
);

public sealed record PortalCandidateAvatarResponse(
    string? AvatarUrl
);
