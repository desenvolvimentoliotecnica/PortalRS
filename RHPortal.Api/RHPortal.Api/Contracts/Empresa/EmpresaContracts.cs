using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Empresa;

public sealed record EmpresaCreateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    bool IsActive = true
);

public sealed record EmpresaUpdateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    bool IsActive
);

public sealed record EmpresaResponse(
    Guid Id,
    string Code,
    string Description,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record EmpresaLookupItem(
    Guid Id,
    string Code,
    string Description,
    string DisplayLabel
);
