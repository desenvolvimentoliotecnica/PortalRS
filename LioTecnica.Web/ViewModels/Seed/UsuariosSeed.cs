namespace LioTecnica.Web.ViewModels.Seed;

public sealed class RoleSeed
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public string Desc { get; init; } = "";
    public Dictionary<string, PermissionSeed> Perms { get; init; } = new();
    public bool BuiltIn { get; init; }
    public string CreatedAt { get; init; } = "";
    public string UpdatedAt { get; init; } = "";
}

public sealed class PermissionSeed
{
    public bool View { get; init; }
    public bool Create { get; init; }
    public bool Edit { get; init; }
    public bool Delete { get; init; }
    public bool Export { get; init; }
    public bool Admin { get; init; }
}

public sealed class UserSeed
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public string Email { get; init; } = "";
    public string Dept { get; init; } = "";
    public string Status { get; init; } = "";
    public IReadOnlyList<string> RoleIds { get; init; } = Array.Empty<string>();
    public bool MfaEnabled { get; init; }
    public string CreatedAt { get; init; } = "";
    public string UpdatedAt { get; init; } = "";
    public string? LastLoginAt { get; init; }
}
