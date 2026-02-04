using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Ai;

// ----- Keys -----
public sealed record AiProviderKeyListItemResponse(
    Guid Id,
    string Provider,
    string Name,
    bool IsActive,
    bool IsDefault,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record AiProviderKeyCreateRequest(
    [Required, MinLength(1), MaxLength(64)] string Provider,
    [Required, MinLength(1), MaxLength(120)] string Name,
    [Required, MinLength(1)] string Key,
    bool IsDefault = false
);

public sealed record AiProviderKeyUpdateRequest(
    [Required, MinLength(1), MaxLength(120)] string Name,
    bool IsActive,
    bool IsDefault,
    string? Key
);

// ----- Models -----
public sealed record AiModelListItemResponse(
    Guid Id,
    Guid AiProviderKeyId,
    string ModelId,
    string DisplayName,
    bool IsDefault
);

public sealed record AiModelCreateRequest(
    [Required] Guid AiProviderKeyId,
    [Required, MinLength(1), MaxLength(120)] string ModelId,
    [Required, MinLength(1), MaxLength(160)] string DisplayName,
    bool IsDefault = false
);

public sealed record AiModelUpdateRequest(
    [Required, MinLength(1), MaxLength(120)] string ModelId,
    [Required, MinLength(1), MaxLength(160)] string DisplayName,
    bool IsDefault
);

// ----- Usage summary by tenant -----
public sealed record AiUsageSummaryByTenantItem(
    string TenantId,
    decimal TotalCost,
    int UsageCount
);

public sealed record AiUsageSummaryByTenantResponse(
    IReadOnlyList<AiUsageSummaryByTenantItem> ByTenant,
    decimal TotalCost,
    int TotalUsageCount
);

// ----- Usage summary by user -----
public sealed record AiUsageSummaryByUserItem(
    string TenantId,
    Guid? UserId,
    string? UserName,
    decimal TotalCost,
    int UsageCount
);

public sealed record AiUsageSummaryByUserResponse(
    IReadOnlyList<AiUsageSummaryByUserItem> ByUser,
    decimal TotalCost,
    int TotalUsageCount
);

// ----- Usage detail (per line) -----
public sealed record AiUsageDetailItem(
    Guid Id,
    string TenantId,
    Guid? UserId,
    string? UserName,
    string Module,
    string? ModelDisplayName,
    decimal Cost,
    string? ActionDescription,
    string? RequestMessage,
    DateTimeOffset CreatedAtUtc
);

public sealed record AiUsageDetailQuery(
    string? TenantId,
    Guid? UserId,
    string? Module,
    DateTimeOffset? From,
    DateTimeOffset? To,
    int Page = 1,
    int PageSize = 50
);

// ----- Unified AI invoke (api/ai) -----
public sealed record AiInvokeRequest(
    [Required, MinLength(1), MaxLength(120)] string Module,
    [MaxLength(500)] string? ActionDescription,
    [MaxLength(8000)] string? RequestMessage,
    Guid? ModelId,
    object? Payload
);

public sealed record AiInvokeResponse(
    string Content,
    decimal Cost
);
