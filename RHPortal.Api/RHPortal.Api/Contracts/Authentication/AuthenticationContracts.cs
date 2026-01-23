using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Authentication;

public sealed record LoginRequest(
    [Required, EmailAddress, MaxLength(180)] string Email,
    [Required, MinLength(8), MaxLength(120)] string Password
);

public sealed record EntraLoginRequest(
    [Required] string IdToken
);

public sealed record LoginResponse(
    string AccessToken,
    int AccessTokenExpirationMinutes,
    Guid UserId,
    string Email,
    string FullName,
    string TenantId,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions
);

public sealed record CurrentUserResponse(
    Guid UserId,
    string Email,
    string FullName,
    string TenantId,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions
);
