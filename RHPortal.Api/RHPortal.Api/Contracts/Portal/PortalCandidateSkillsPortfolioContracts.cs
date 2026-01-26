using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidateSkillDto(
    Guid Id,
    string Tipo,
    string Nome,
    string Nivel,
    string? Evidencia
);

public sealed record PortalCandidateCertificationDto(
    Guid Id,
    string Nome,
    string? Instituicao,
    string? Ano,
    string? Link
);

public sealed record PortalCandidatePortfolioLinksDto(
    string? Linkedin,
    string? Github,
    string? Portfolio,
    string? Drive
);

public sealed record PortalCandidatePortfolioPrefsDto(
    string? WorkModel,
    string? Availability,
    string? Salary,
    string? Shift,
    string? Note
);

public sealed record PortalCandidateSkillsPortfolioResponse(
    IReadOnlyList<PortalCandidateSkillDto> Skills,
    IReadOnlyList<PortalCandidateCertificationDto> Certifications,
    PortalCandidatePortfolioLinksDto Links,
    PortalCandidatePortfolioPrefsDto Preferences,
    string? Tags
);

public sealed record PortalCandidateSkillRequest(
    [Required, MaxLength(40)] string Tipo,
    [Required, MaxLength(120)] string Nome,
    [Required, MaxLength(40)] string Nivel,
    [MaxLength(300)] string? Evidencia
);

public sealed record PortalCandidateCertificationRequest(
    [Required, MaxLength(160)] string Nome,
    [MaxLength(160)] string? Instituicao,
    [MaxLength(10)] string? Ano,
    [MaxLength(260)] string? Link
);

public sealed record PortalCandidatePortfolioUpdateRequest(
    [MaxLength(40)] string? WorkModel,
    [MaxLength(40)] string? Availability,
    [MaxLength(40)] string? Salary,
    [MaxLength(40)] string? Shift,
    [MaxLength(200)] string? Note,
    [MaxLength(260)] string? Linkedin,
    [MaxLength(260)] string? Github,
    [MaxLength(260)] string? Portfolio,
    [MaxLength(260)] string? Drive,
    [MaxLength(400)] string? Tags
);

public sealed record PortalCandidatePortfolioResponse(
    PortalCandidatePortfolioLinksDto Links,
    PortalCandidatePortfolioPrefsDto Preferences,
    string? Tags
);
