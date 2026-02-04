using System.ComponentModel.DataAnnotations;
using RHPortal.Api.Domain.Enums;

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
    IReadOnlyList<string> Permissions,
    Guid? FuncionarioId,
    Guid? AreaId,
    ProfileVisibilityScope VisibilityScope,
    VagasDataScope VagasDataScope,
    bool IsReadOnly
);

public sealed record CurrentUserResponse(
    Guid UserId,
    string Email,
    string FullName,
    string TenantId,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions,
    Guid? FuncionarioId,
    Guid? AreaId,
    ProfileVisibilityScope VisibilityScope,
    VagasDataScope VagasDataScope,
    bool IsReadOnly
);

public sealed record AllowedTenantItem(string TenantId, string Name);

public sealed record AllowedTenantsResponse(IReadOnlyList<AllowedTenantItem> Tenants);

public sealed record SwitchTenantRequest(
    [Required, MinLength(1), MaxLength(64)] string TenantId
);

public sealed record SwitchTenantResponse(string AccessToken, string TenantId);
