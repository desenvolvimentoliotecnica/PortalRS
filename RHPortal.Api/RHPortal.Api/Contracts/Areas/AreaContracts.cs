using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Areas;

public sealed record AreaCreateRequest(
    [Required, MaxLength(40)] string Code,
    [Required, MaxLength(120)] string Name,
    [MaxLength(1000)] string? Description,
    bool IsActive,
    Guid? ParentId,
    Guid? OwnerFuncionarioId
);

public sealed record AreaUpdateRequest(
    [Required, MaxLength(40)] string Code,
    [Required, MaxLength(120)] string Name,
    [MaxLength(1000)] string? Description,
    bool IsActive,
    Guid? ParentId,
    Guid? OwnerFuncionarioId
);

public sealed record AreaResponse(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    bool IsActive,
    Guid? ParentId,
    Guid? OwnerFuncionarioId
);
