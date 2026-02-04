using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Owner;

public sealed record OwnerLoginRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MinLength(8), MaxLength(120)] string Password
);

public sealed record OwnerLoginResponse(
    string AccessToken,
    int AccessTokenExpirationMinutes,
    Guid OwnerId,
    string Email,
    string TenantId,
    IReadOnlyList<string> Roles
);

public sealed record TenantListItemResponse(
    string TenantId,
    string Name,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

/// <summary>Detalhes do tenant para tela de detalhes (inclui criador).</summary>
public sealed record TenantDetailResponse(
    string TenantId,
    string Name,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    Guid? CreatedByOwnerId,
    string? CreatedByOwnerEmail
);

public sealed record CreateTenantRequest(
    [Required, MinLength(2), MaxLength(64)] string TenantId,
    [Required, MinLength(2), MaxLength(120)] string Name
);

/// <summary>Status de migrações do banco do tenant (diferença em relação ao modelo atual).</summary>
public sealed record TenantMigrationStatusResponse(
    string TenantId,
    bool IsUpToDate,
    int PendingCount,
    IReadOnlyList<string> PendingMigrationIds,
    string? ErrorMessage
);

/// <summary>Resultado da aplicação de migrações em um tenant.</summary>
public sealed record TenantMigrationsApplyResponse(int AppliedCount);
