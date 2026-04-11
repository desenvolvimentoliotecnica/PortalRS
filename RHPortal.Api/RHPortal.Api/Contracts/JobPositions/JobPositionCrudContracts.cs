using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.JobPositions;

public sealed record JobPositionCreateRequest(
    [Required, MaxLength(40)] string Code,
    [Required, MaxLength(160)] string Name,
    CargoStatus Status,
    Guid? AreaId,
    SeniorityLevel Seniority,
    [MaxLength(180)] string? Type,
    [MaxLength(30)] string? OccupationalClassification,
    [MaxLength(1000)] string? Description,
    [MaxLength(1)] string? SimilarityIndicator,
    [MaxLength(500)] string? FullDescription,
    Guid? NivelCargoId,
    [MaxLength(40)] string? DesEnvelPagto,
    int? TotvsCargoBasicId,
    int? TotvsNivCargoId
);

public sealed record JobPositionUpdateRequest(
    [Required, MaxLength(40)] string Code,
    [Required, MaxLength(160)] string Name,
    CargoStatus Status,
    Guid? AreaId,
    SeniorityLevel Seniority,
    [MaxLength(180)] string? Type,
    [MaxLength(30)] string? OccupationalClassification,
    [MaxLength(1000)] string? Description,
    [MaxLength(1)] string? SimilarityIndicator,
    [MaxLength(500)] string? FullDescription,
    Guid? NivelCargoId,
    [MaxLength(40)] string? DesEnvelPagto,
    int? TotvsCargoBasicId,
    int? TotvsNivCargoId
);

/// <summary>
/// Item para importação em lote. Código opcional — se omitido é gerado automaticamente.
/// Combina cargo_basic + niv_cargo do Datasul em um único registro.
/// </summary>
public sealed record JobPositionImportItem(
    [MaxLength(40)] string? Code,
    [Required, MaxLength(160)] string Name,
    Guid? AreaId,
    [MaxLength(30)] string? OccupationalClassification,
    [MaxLength(500)] string? FullDescription,
    [MaxLength(40)] string? DesEnvelPagto,
    Guid? NivelCargoId,
    SeniorityLevel? Seniority,
    [MaxLength(180)] string? Type,
    [MaxLength(1)] string? SimilarityIndicator,
    int? TotvsCargoBasicId,
    int? TotvsNivCargoId
);

public sealed record JobPositionImportResult(
    int Created,
    int Updated,
    int Skipped,
    List<string> Errors
);

public sealed record JobPositionLookupItem(
    Guid Id,
    string Code,
    string Name,
    Guid? AreaId,
    string? AreaName,
    string? Seniority
);

public sealed record JobPositionResponse(
    Guid Id,
    string Code,
    string Name,
    CargoStatus Status,
    Guid? AreaId,
    string AreaName,
    SeniorityLevel Seniority,
    string? Type,
    string? OccupationalClassification,
    string? Description,
    string? SimilarityIndicator,
    string? FullDescription,
    Guid? NivelCargoId,
    string? NivelCargoNomReduz,
    string? NivelCargoNomComplet,
    string? DesEnvelPagto,
    int? TotvsCargoBasicId,
    int? TotvsNivCargoId,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);
