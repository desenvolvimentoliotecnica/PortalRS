using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.UnidadeLotacao;

public sealed record UnidadeLotacaoCreateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(120)] string? Location,
    [MaxLength(120)] string? Manager,
    [MaxLength(500)] string? Notes,
    bool IsActive
);

public sealed record UnidadeLotacaoUpdateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(120)] string? Location,
    [MaxLength(120)] string? Manager,
    [MaxLength(500)] string? Notes,
    bool IsActive
);

public sealed record UnidadeLotacaoResponse(
    Guid Id,
    string Code,
    string Description,
    string? Location,
    string? Manager,
    string? Notes,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record UnidadeLotacaoLookupItem(
    Guid Id,
    string Code,
    string Description,
    string DisplayLabel
);
