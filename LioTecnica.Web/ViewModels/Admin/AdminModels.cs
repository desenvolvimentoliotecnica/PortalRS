using System.ComponentModel.DataAnnotations;

namespace LioTecnica.Web.ViewModels.Admin;

public sealed record UserListItemViewModel(
    Guid Id,
    string FullName,
    string Email,
    bool IsActive,
    IReadOnlyList<string> Roles
);

public sealed record UserResponseViewModel(
    Guid Id,
    string FullName,
    string Email,
    bool IsActive,
    IReadOnlyList<RoleInfoViewModel> Roles,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record RoleListItemViewModel(
    Guid Id,
    string Name,
    string Description,
    bool IsActive
);

public sealed record RoleResponseViewModel(
    Guid Id,
    string Name,
    string Description,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record RoleInfoViewModel(
    Guid Id,
    string Name
);

public sealed record MenuListItemViewModel(
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

public sealed record MenuResponseViewModel(
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

public sealed record MenuForCurrentUserViewModel(
    Guid Id,
    string DisplayName,
    string Route,
    string Icon,
    int Order,
    Guid? ParentId,
    string PermissionKey,
    bool OpenInNewTab
);

public sealed record RoleMenuAssignmentViewModel(
    Guid MenuId,
    string PermissionKey
);

public sealed class UsersPageViewModel
{
    public IReadOnlyList<UserListItemViewModel> Users { get; init; } = Array.Empty<UserListItemViewModel>();
    public IReadOnlyList<RoleListItemViewModel> Roles { get; init; } = Array.Empty<RoleListItemViewModel>();
}

public sealed class UserEditViewModel
{
    public UserFormModel User { get; init; } = new();
    public IReadOnlyList<RoleListItemViewModel> Roles { get; init; } = Array.Empty<RoleListItemViewModel>();
    public bool IsNew { get; init; }
}

public sealed class RolesPageViewModel
{
    public IReadOnlyList<RoleListItemViewModel> Roles { get; init; } = Array.Empty<RoleListItemViewModel>();
}

public sealed class MenusPageViewModel
{
    public IReadOnlyList<MenuListItemViewModel> Menus { get; init; } = Array.Empty<MenuListItemViewModel>();
}

public sealed class AccessesPageViewModel
{
    public IReadOnlyList<RoleListItemViewModel> Roles { get; init; } = Array.Empty<RoleListItemViewModel>();
    public IReadOnlyList<MenuListItemViewModel> Menus { get; init; } = Array.Empty<MenuListItemViewModel>();
    public IReadOnlyList<RoleMenuAssignmentViewModel> RoleMenus { get; init; } = Array.Empty<RoleMenuAssignmentViewModel>();
    public Guid? SelectedRoleId { get; init; }
}

public sealed class UserFormModel
{
    public Guid? Id { get; set; }

    [Required, EmailAddress, MaxLength(180)]
    public string Email { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string FullName { get; set; } = string.Empty;

    [MinLength(8), MaxLength(120)]
    public string? Password { get; set; }

    public bool IsActive { get; set; } = true;

    public List<Guid> RoleIds { get; set; } = new();
}

public sealed class RoleFormModel
{
    public Guid? Id { get; set; }

    [Required, MaxLength(160)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(400)]
    public string Description { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}

public sealed class MenuFormModel
{
    public Guid? Id { get; set; }

    [Required, MaxLength(160)]
    public string DisplayName { get; set; } = string.Empty;

    [Required, MaxLength(240)]
    public string Route { get; set; } = string.Empty;

    [MaxLength(120)]
    public string Icon { get; set; } = string.Empty;

    public int Order { get; set; }

    public Guid? ParentId { get; set; }

    [Required, MaxLength(160)]
    public string PermissionKey { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}

public sealed class RoleMenusFormModel
{
    [Required]
    public Guid RoleId { get; set; }

    public List<RoleMenuAssignmentViewModel> Items { get; set; } = new();
}

public sealed class AccessesFormModel
{
    [Required]
    public Guid RoleId { get; set; }

    public List<string> SelectedPermissions { get; set; } = new();
}
