using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Cargos;

public sealed record CargoCreateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(30)] string? OccupationalClassification,
    [MaxLength(30)] string? CargoType,
    [MaxLength(1)] string? SimilarityIndicator,
    [MaxLength(500)] string? FullDescription,
    bool IsActive
);

public sealed record CargoUpdateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(30)] string? OccupationalClassification,
    [MaxLength(30)] string? CargoType,
    [MaxLength(1)] string? SimilarityIndicator,
    [MaxLength(500)] string? FullDescription,
    bool IsActive
);

public sealed record CargoResponse(
    Guid Id,
    string Code,
    string Description,
    string? OccupationalClassification,
    string? CargoType,
    string? SimilarityIndicator,
    string? FullDescription,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record CargoLookupItem(
    Guid Id,
    string Code,
    string Description,
    string DisplayLabel
);
