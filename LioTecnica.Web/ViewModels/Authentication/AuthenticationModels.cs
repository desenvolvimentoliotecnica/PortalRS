using System.ComponentModel.DataAnnotations;

namespace LioTecnica.Web.ViewModels.Authentication;

public sealed class LoginViewModel
{
    [Required, EmailAddress, MaxLength(180)]
    public string Email { get; set; } = string.Empty;

    [Required, MinLength(8), MaxLength(120)]
    public string Password { get; set; } = string.Empty;

    [Required, MaxLength(64)]
    public string TenantId { get; set; } = string.Empty;

    public string? ReturnUrl { get; set; }
}

public sealed record LoginResponse(
    string AccessToken,
    int AccessTokenExpirationMinutes,
    Guid UserId,
    string Email,
    string FullName,
    string TenantId,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions,
    int VisibilityScope,
    int VagasDataScope,
    bool IsReadOnly
);

public sealed record CurrentUserResponse(
    Guid UserId,
    string Email,
    string FullName,
    string TenantId,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions,
    int VisibilityScope,
    int VagasDataScope,
    bool IsReadOnly
);

public sealed record OwnerLoginResponse(
    string AccessToken,
    int AccessTokenExpirationMinutes,
    Guid OwnerId,
    string Email,
    string TenantId,
    IReadOnlyList<string> Roles
);
