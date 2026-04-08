using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.CentroCusto;

public sealed record CentroCustoCreateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(120)] string? Manager,
    [MaxLength(500)] string? Notes,
    bool IsActive
);

public sealed record CentroCustoUpdateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(120)] string? Manager,
    [MaxLength(500)] string? Notes,
    bool IsActive
);

public sealed record CentroCustoResponse(
    Guid Id,
    string Code,
    string Description,
    string? Manager,
    string? Notes,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record CentroCustoLookupItem(
    Guid Id,
    string Code,
    string Description,
    string DisplayLabel
);
