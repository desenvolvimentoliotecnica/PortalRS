using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Portal;

public sealed record PortalCandidateEducationSummaryDto(
    string? Nivel,
    string? AreaPrincipal,
    string? Situacao,
    string? DataConclusao,
    string? Destaques
);

public sealed record PortalCandidateEducationItemDto(
    Guid Id,
    string Curso,
    string? Instituicao,
    string? Tipo,
    string? Status,
    string? Inicio,
    string? Fim,
    string? Observacoes,
    string? Link
);

public sealed record PortalCandidateEducationResponse(
    PortalCandidateEducationSummaryDto Summary,
    IReadOnlyList<PortalCandidateEducationItemDto> Items
);

public sealed record PortalCandidateEducationSummaryRequest(
    [MaxLength(60)] string? Nivel,
    [MaxLength(120)] string? AreaPrincipal,
    [MaxLength(40)] string? Situacao,
    [MaxLength(20)] string? DataConclusao,
    [MaxLength(260)] string? Destaques
);

public sealed record PortalCandidateEducationItemRequest(
    [Required, MaxLength(160)] string Curso,
    [MaxLength(160)] string? Instituicao,
    [MaxLength(40)] string? Tipo,
    [MaxLength(40)] string? Status,
    [MaxLength(20)] string? Inicio,
    [MaxLength(20)] string? Fim,
    [MaxLength(800)] string? Observacoes,
    [MaxLength(260)] string? Link
);
