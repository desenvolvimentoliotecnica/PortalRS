using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Turno;

public sealed record TurnoCreateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(5)] string? StartTime,
    [MaxLength(5)] string? EndTime,
    [MaxLength(500)] string? Notes,
    bool IsActive,
    Guid? UnidadeLotacaoId = null,
    string? GradeHorarioJson = null
);

public sealed record TurnoUpdateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(5)] string? StartTime,
    [MaxLength(5)] string? EndTime,
    [MaxLength(500)] string? Notes,
    bool IsActive,
    Guid? UnidadeLotacaoId = null,
    string? GradeHorarioJson = null
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
    DateTimeOffset UpdatedAtUtc,
    Guid? UnidadeLotacaoId = null,
    string? UnidadeLotacaoNome = null,
    string? GradeHorarioJson = null
);

public sealed record TurnoLookupItem(
    Guid Id,
    string Code,
    string Description,
    string DisplayLabel,
    Guid? UnidadeLotacaoId = null,
    string? StartTime = null,
    string? EndTime = null
);

/// <summary>Item para importação em lote de turnos.</summary>
public sealed record TurnoImportItem(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(5)] string? StartTime,
    [MaxLength(5)] string? EndTime,
    [MaxLength(500)] string? Notes,
    bool IsActive,
    Guid? UnidadeLotacaoId = null
);

public sealed record TurnoImportResult(int Created, int Updated, int Skipped, IReadOnlyList<string> Errors);
