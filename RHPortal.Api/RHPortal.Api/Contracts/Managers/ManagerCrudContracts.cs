using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Managers;

public sealed record ManagerCreateRequest(
    [Required, MaxLength(160)] string Name,
    [Required, MaxLength(180), EmailAddress] string Email,
    [MaxLength(40)] string? Phone,
    ManagerStatus Status,
    int Headcount,
    [Required] Guid UnitId,
    [Required] Guid AreaId,
    [Required] Guid JobPositionId,
    [MaxLength(1000)] string? Notes
);

public sealed record ManagerUpdateRequest(
    [Required, MaxLength(160)] string Name,
    [Required, MaxLength(180), EmailAddress] string Email,
    [MaxLength(40)] string? Phone,
    ManagerStatus Status,
    int Headcount,
    [Required] Guid UnitId,
    [Required] Guid AreaId,
    [Required] Guid JobPositionId,
    [MaxLength(1000)] string? Notes
);

public sealed record ManagerResponse(
    Guid Id,
    string Name,
    string Email,
    string? Phone,
    ManagerStatus Status,
    int Headcount,
    Guid UnitId,
    string UnitName,
    Guid AreaId,
    string AreaName,
    Guid JobPositionId,
    string JobPositionName,
    string? Notes,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);
