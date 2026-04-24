using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.JobPositions;

public sealed record JobPositionGridRowResponse(
    Guid Id,
    string Name,
    string Code,
    string CentroCustoNome,
    /// <summary>Centro de custo — absorveu Area em 31.2.</summary>
    Guid? CentroCustoId,
    SeniorityLevel Seniority,
    int FuncionariosCount,
    CargoStatus Status,
    DateTimeOffset UpdatedAtUtc,
    int? TotvsCargoBasicId,
    int? TotvsNivCargoId,
    string? NivelCargoNomReduz,
    string? DesEnvelPagto,
    string? OccupationalClassification
);
