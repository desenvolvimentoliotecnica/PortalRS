using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.EixoVaga;

public sealed record EixoVagaCreateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Name,
    [MaxLength(400)] string? Description,
    int? SlaDiasMetaFechamento,
    bool IsActive
);

public sealed record EixoVagaUpdateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Name,
    [MaxLength(400)] string? Description,
    int? SlaDiasMetaFechamento,
    bool IsActive
);

public sealed record EixoVagaResponse(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    int? SlaDiasMetaFechamento,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record EixoVagaLookupItem(
    Guid Id,
    string Code,
    string Name,
    string DisplayLabel,
    int? SlaDiasMetaFechamento
);
