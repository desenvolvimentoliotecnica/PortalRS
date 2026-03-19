using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Funcionarios;

public sealed record FuncionarioGridRowResponse(
    Guid Id,
    string Name,
    string Email,
    string? Phone,
    FuncionarioStatus Status,
    int Headcount,
    Guid? UnitId,
    string? UnitName,
    Guid? AreaId,
    string? AreaName,
    Guid? JobPositionId,
    string? JobPositionName,
    Guid? RequisitoCategoriaId,
    string? RequisitoCategoriaName,
    Guid? GestorDiretoId,
    string? GestorDiretoNome,
    Guid? NivelHierarquicoId,
    string? NivelHierarquicoNome
);
