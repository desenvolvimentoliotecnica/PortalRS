using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.CategoriaSalarial;

public sealed record CategoriaSalarialCreateRequest(
    [Required, MaxLength(10)] string Code,
    [Required, MaxLength(120)] string Description,
    bool IsActive
);

public sealed record CategoriaSalarialUpdateRequest(
    [Required, MaxLength(10)] string Code,
    [Required, MaxLength(120)] string Description,
    bool IsActive
);

public sealed record CategoriaSalarialResponse(
    Guid Id,
    string Code,
    string Description,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record CategoriaSalarialLookupItem(
    Guid Id,
    string Code,
    string Description,
    string DisplayLabel
);
