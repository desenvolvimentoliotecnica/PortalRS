using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.DescricaoCargo;

public sealed record DescricaoCargoCreateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(200)] string Title,
    [MaxLength(2000)] string? Summary,
    string? Responsibilities,
    string? Requirements,
    string? NiceToHave,
    string? Benefits,
    bool IsTemplate,
    bool IsActive,
    Guid? NivelCargoId = null
);

public sealed record DescricaoCargoUpdateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(200)] string Title,
    [MaxLength(2000)] string? Summary,
    string? Responsibilities,
    string? Requirements,
    string? NiceToHave,
    string? Benefits,
    bool IsTemplate,
    bool IsActive,
    Guid? NivelCargoId = null
);

public sealed record DescricaoCargoResponse(
    Guid Id,
    string Code,
    string Title,
    string? Summary,
    string? Responsibilities,
    string? Requirements,
    string? NiceToHave,
    string? Benefits,
    bool IsTemplate,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    Guid? NivelCargoId = null,
    string? NivelCargoNome = null
);

public sealed record DescricaoCargoLookupItem(
    Guid Id,
    string Code,
    string Title,
    string DisplayLabel,
    bool IsTemplate
);
