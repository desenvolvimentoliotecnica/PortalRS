using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.NivelCargo;

public sealed record NivelCargoCreateRequest(
    int CdnNivCargo,
    [Required, MaxLength(6)] string NomReduz,
    [Required, MaxLength(40)] string NomComplet,
    bool IsActive
);

public sealed record NivelCargoUpdateRequest(
    int CdnNivCargo,
    [Required, MaxLength(6)] string NomReduz,
    [Required, MaxLength(40)] string NomComplet,
    bool IsActive
);

public sealed record NivelCargoResponse(
    Guid Id,
    int CdnNivCargo,
    string NomReduz,
    string NomComplet,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record NivelCargoLookupItem(
    Guid Id,
    int CdnNivCargo,
    string NomReduz,
    string NomComplet,
    string DisplayLabel
);
