using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Departments;

public sealed record DepartmentCreateRequest(
    [Required, MaxLength(40)] string Code,
    [Required, MaxLength(120)] string Name,
    Guid? AreaId,
    DepartmentStatus Status,
    int Headcount,
    [MaxLength(120)] string? ManagerName,
    [MaxLength(180)] string? ManagerEmail,
    [MaxLength(40)] string? Phone,
    [MaxLength(80)] string? BranchOrLocation,
    [MaxLength(1000)] string? Description
);

public sealed record DepartmentUpdateRequest(
    [Required, MaxLength(40)] string Code,
    [Required, MaxLength(120)] string Name,
    Guid? AreaId,
    DepartmentStatus Status,
    int Headcount,
    [MaxLength(120)] string? ManagerName,
    [MaxLength(180)] string? ManagerEmail,
    [MaxLength(40)] string? Phone,
    [MaxLength(80)] string? BranchOrLocation,
    [MaxLength(1000)] string? Description
);

public sealed record DepartmentResponse(
    Guid Id,
    string Code,
    string Name,
    Guid? AreaId,
    string? AreaName,
    DepartmentStatus Status,
    int Headcount,
    string? ManagerName,
    string? ManagerEmail,
    string? Phone,
    string? BranchOrLocation,
    string? Description,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);
