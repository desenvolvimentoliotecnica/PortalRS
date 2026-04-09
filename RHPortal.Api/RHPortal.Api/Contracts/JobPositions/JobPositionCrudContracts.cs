using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.JobPositions;

public sealed record JobPositionCreateRequest(
    [Required, MaxLength(40)] string Code,
    [Required, MaxLength(160)] string Name,
    CargoStatus Status,
    [Required] Guid AreaId,
    SeniorityLevel Seniority,
    [MaxLength(180)] string? Type,
    [MaxLength(30)] string? OccupationalClassification,
    [MaxLength(1000)] string? Description,
    [MaxLength(1)] string? SimilarityIndicator,
    [MaxLength(500)] string? FullDescription
);

public sealed record JobPositionUpdateRequest(
    [Required, MaxLength(40)] string Code,
    [Required, MaxLength(160)] string Name,
    CargoStatus Status,
    [Required] Guid AreaId,
    SeniorityLevel Seniority,
    [MaxLength(180)] string? Type,
    [MaxLength(30)] string? OccupationalClassification,
    [MaxLength(1000)] string? Description,
    [MaxLength(1)] string? SimilarityIndicator,
    [MaxLength(500)] string? FullDescription
);

public sealed record JobPositionLookupItem(
    Guid Id,
    string Code,
    string Name,
    Guid? AreaId,
    string? AreaName,
    string? Seniority
);

public sealed record JobPositionResponse(
    Guid Id,
    string Code,
    string Name,
    CargoStatus Status,
    Guid AreaId,
    string AreaName,
    SeniorityLevel Seniority,
    string? Type,
    string? OccupationalClassification,
    string? Description,
    string? SimilarityIndicator,
    string? FullDescription,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);
