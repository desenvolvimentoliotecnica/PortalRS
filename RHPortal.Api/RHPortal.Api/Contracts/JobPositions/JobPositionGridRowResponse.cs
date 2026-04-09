using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.JobPositions;

public sealed record JobPositionGridRowResponse(
    Guid Id,
    string Name,
    string Code,
    string AreaName,
    Guid AreaId,
    SeniorityLevel Seniority,
    int FuncionariosCount,
    CargoStatus Status,
    DateTimeOffset UpdatedAtUtc
);
