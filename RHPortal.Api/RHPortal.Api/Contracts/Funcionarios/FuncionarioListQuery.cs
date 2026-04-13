using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Funcionarios;

public sealed record FuncionarioListQuery(
    string? Search,
    FuncionarioStatus? Status,
    Guid? UnitId,
    Guid? AreaId,
    Guid? JobPositionId,
    int Page = 1,
    int PageSize = 20,
    string Sort = "funcionario",
    string Dir = "asc",
    bool? HasMissingData = null,
    Guid? UnidadeLotacaoId = null,
    Guid? CentroCustoId = null
);
