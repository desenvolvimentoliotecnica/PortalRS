using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Metas;

public sealed record MetaResponse(
    Guid Id,
    Guid FuncionarioId,
    string FuncionarioNome,
    Guid CriadaPorId,
    string CriadaPorNome,
    string Titulo,
    string? Descricao,
    decimal ValorMeta,
    decimal ValorAtual,
    string Unidade,
    DateOnly? Prazo,
    MetaStatus Status,
    decimal PercentualConcluido,
    DateTimeOffset CriadoEmUtc,
    DateTimeOffset AtualizadoEmUtc
);

public sealed record MetaCreateRequest(
    Guid FuncionarioId,
    string Titulo,
    string? Descricao,
    decimal ValorMeta,
    string Unidade,
    DateOnly? Prazo
);

public sealed record MetaUpdateRequest(
    string Titulo,
    string? Descricao,
    decimal ValorMeta,
    string Unidade,
    DateOnly? Prazo
);

public sealed record MetaProgressoRequest(
    decimal ValorAtual
);
