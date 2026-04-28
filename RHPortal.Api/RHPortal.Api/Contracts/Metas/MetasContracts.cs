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
    DateTimeOffset AtualizadoEmUtc,
    /// <summary>OKR cascateado — id da meta-pai (Entrega 1.6).</summary>
    Guid? ParentMetaId = null,
    /// <summary>Total de filhas (informativo na árvore — Entrega 1.6).</summary>
    int TotalChildren = 0,
    /// <summary>Status do último check-in (Entrega 1.6, 1=verde, 2=amarelo, 3=vermelho).</summary>
    int? UltimoCheckinStatus = null,
    DateTimeOffset? UltimoCheckinEmUtc = null
);

public sealed record MetaCreateRequest(
    Guid FuncionarioId,
    string Titulo,
    string? Descricao,
    decimal ValorMeta,
    string Unidade,
    DateOnly? Prazo,
    /// <summary>OKR cascateado — opcional, id da meta-pai (Entrega 1.6).</summary>
    Guid? ParentMetaId = null
);

public sealed record MetaUpdateRequest(
    string Titulo,
    string? Descricao,
    decimal ValorMeta,
    string Unidade,
    DateOnly? Prazo,
    Guid? ParentMetaId = null
);

public sealed record MetaProgressoRequest(
    decimal ValorAtual
);

// ── Check-ins (Entrega 1.6 — Fase 1 Paridade Feedz) ──

public sealed record MetaCheckinCreateRequest(
    /// <summary>1=Verde (no caminho), 2=Amarelo (atenção), 3=Vermelho (em risco).</summary>
    int Status,
    decimal? ValorAtual = null,
    string? Comentario = null
);

public sealed record MetaCheckinResponse(
    Guid Id,
    Guid MetaId,
    int Status,
    decimal? ValorAtual,
    string? Comentario,
    Guid CriadoPorId,
    string CriadoPorNome,
    DateTimeOffset CriadoEmUtc
);

// ── Árvore de OKRs cascateados (Entrega 1.6) ──

public sealed record MetaTreeNode(
    Guid Id,
    string Titulo,
    string FuncionarioNome,
    decimal ValorMeta,
    decimal ValorAtual,
    string Unidade,
    decimal PercentualConcluido,
    MetaStatus Status,
    int? UltimoCheckinStatus,
    List<MetaTreeNode> Children
);
