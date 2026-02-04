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
    [MaxLength(1000)] string? Description
);

public sealed record JobPositionUpdateRequest(
    [Required, MaxLength(40)] string Code,
    [Required, MaxLength(160)] string Name,
    CargoStatus Status,
    [Required] Guid AreaId,
    SeniorityLevel Seniority,
    [MaxLength(180)] string? Type,
    [MaxLength(1000)] string? Description
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
    string? Description,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);
