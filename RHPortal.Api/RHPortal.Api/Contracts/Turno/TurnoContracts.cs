using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Turno;

public sealed record TurnoCreateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(5)] string? StartTime,
    [MaxLength(5)] string? EndTime,
    [MaxLength(500)] string? Notes,
    bool IsActive
);

public sealed record TurnoUpdateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(5)] string? StartTime,
    [MaxLength(5)] string? EndTime,
    [MaxLength(500)] string? Notes,
    bool IsActive
);

public sealed record TurnoResponse(
    Guid Id,
    string Code,
    string Description,
    string? StartTime,
    string? EndTime,
    string? Notes,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record TurnoLookupItem(
    Guid Id,
    string Code,
    string Description,
    string DisplayLabel
);

/// <summary>Item para importação em lote de turnos.</summary>
public sealed record TurnoImportItem(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(5)] string? StartTime,
    [MaxLength(5)] string? EndTime,
    [MaxLength(500)] string? Notes,
    bool IsActive
);

public sealed record TurnoImportResult(int Created, int Updated, int Skipped, IReadOnlyList<string> Errors);
