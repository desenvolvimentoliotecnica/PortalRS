using System.ComponentModel.DataAnnotations;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Roles;

public sealed record RoleListItemResponse(
    Guid Id,
    string Name,
    string Description,
    bool IsActive,
    ProfileVisibilityScope VisibilityScope,
    VagasDataScope VagasDataScope,
    ProfileAccessMode AccessMode,
    RoleTipo Tipo
);

public sealed record RoleResponse(
    Guid Id,
    string Name,
    string Description,
    bool IsActive,
    ProfileVisibilityScope VisibilityScope,
    VagasDataScope VagasDataScope,
    ProfileAccessMode AccessMode,
    RoleTipo Tipo,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record RoleCreateRequest(
    [Required, MaxLength(160)] string Name,
    [MaxLength(400)] string Description,
    bool IsActive,
    ProfileVisibilityScope VisibilityScope,
    VagasDataScope VagasDataScope,
    ProfileAccessMode AccessMode,
    RoleTipo Tipo
);

public sealed record RoleUpdateRequest(
    [Required, MaxLength(160)] string Name,
    [MaxLength(400)] string Description,
    bool IsActive,
    ProfileVisibilityScope VisibilityScope,
    VagasDataScope VagasDataScope,
    ProfileAccessMode AccessMode,
    RoleTipo Tipo
);

public sealed record RoleMenuAssignmentRequest(
    [Required] Guid MenuId,
    [Required, MaxLength(160)] string PermissionKey
);

public sealed record RoleMenusUpdateRequest(
    [Required] IReadOnlyList<RoleMenuAssignmentRequest> Items
);

public sealed record RoleMenuAssignmentResponse(
    Guid MenuId,
    string PermissionKey
);
