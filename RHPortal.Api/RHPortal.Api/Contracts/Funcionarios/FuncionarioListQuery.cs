using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Funcionarios;

public sealed record FuncionarioListQuery(
    string? Search,
    FuncionarioStatus? Status,
    Guid? UnitId,
    Guid? JobPositionId,
    int Page = 1,
    int PageSize = 20,
    string Sort = "funcionario",
    string Dir = "asc",
    bool? HasMissingData = null,
    Guid? UnidadeLotacaoId = null,
    /// <summary>Centro de custo — absorveu Area em 31.2.</summary>
    Guid? CentroCustoId = null,
    Guid? GestorDiretoId = null,
    Guid? OnlyFuncionarioId = null,
    IReadOnlyList<Guid>? GestorUnidadeIds = null,
    /// <summary>Filtrar por CODSITUACAO TOTVS RM (A, F, P, D, I, T, etc.). Null = todos.</summary>
    string? CodSituacaoRm = null
);
