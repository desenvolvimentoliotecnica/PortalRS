using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Menus;

public sealed record MenuListItemResponse(
    Guid Id,
    string DisplayName,
    string Route,
    string Icon,
    int Order,
    Guid? ParentId,
    string PermissionKey,
    bool IsActive,
    bool OpenInNewTab
);

public sealed record MenuResponse(
    Guid Id,
    string DisplayName,
    string Route,
    string Icon,
    int Order,
    Guid? ParentId,
    string PermissionKey,
    bool IsActive,
    bool OpenInNewTab,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record MenuCreateRequest(
    [Required, MaxLength(160)] string DisplayName,
    [Required, MaxLength(240)] string Route,
    [MaxLength(120)] string Icon,
    int Order,
    Guid? ParentId,
    [Required, MaxLength(160)] string PermissionKey,
    bool IsActive,
    bool OpenInNewTab
);

public sealed record MenuUpdateRequest(
    [Required, MaxLength(160)] string DisplayName,
    [Required, MaxLength(240)] string Route,
    [MaxLength(120)] string Icon,
    int Order,
    Guid? ParentId,
    [Required, MaxLength(160)] string PermissionKey,
    bool IsActive,
    bool OpenInNewTab
);

public sealed record MenuForCurrentUserResponse(
    Guid Id,
    string DisplayName,
    string Route,
    string Icon,
    int Order,
    Guid? ParentId,
    string PermissionKey,
    bool OpenInNewTab
);
