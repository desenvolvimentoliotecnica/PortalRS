using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.CategoriaSalarial;

/// <summary>Um degrau (step) na grade percentual. ValorOverride é opcional —
/// quando null, o front calcula como ValorBase × Percentual/100.</summary>
public sealed record CategoriaSalarialStepRequest(
    [Range(0, 1000)] decimal Percentual,
    decimal? ValorOverride,
    int Ordem,
    [MaxLength(200)] string? Observacao
);

public sealed record CategoriaSalarialStepResponse(
    Guid Id,
    decimal Percentual,
    decimal? ValorOverride,
    int Ordem,
    string? Observacao,
    /// <summary>Valor efetivo: override quando presente, caso contrário calculado (ValorBase × Percentual/100).</summary>
    decimal? ValorEfetivo
);

public sealed record CategoriaSalarialCreateRequest(
    [Required, MaxLength(10)] string Code,
    [Required, MaxLength(120)] string Description,
    bool IsActive,
    decimal? ValorBase = null,
    Guid? EmpresaId = null,
    Guid? EstabelecimentoId = null,
    IReadOnlyList<CategoriaSalarialStepRequest>? Steps = null
);

public sealed record CategoriaSalarialUpdateRequest(
    [Required, MaxLength(10)] string Code,
    [Required, MaxLength(120)] string Description,
    bool IsActive,
    decimal? ValorBase = null,
    Guid? EmpresaId = null,
    Guid? EstabelecimentoId = null,
    /// <summary>Lista completa de steps. O servidor substitui a lista existente
    /// pelos items enviados (padrão "replace" — mais simples que diff patch).</summary>
    IReadOnlyList<CategoriaSalarialStepRequest>? Steps = null
);

public sealed record CategoriaSalarialResponse(
    Guid Id,
    string Code,
    string Description,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    decimal? ValorBase = null,
    Guid? EmpresaId = null,
    Guid? EstabelecimentoId = null,
    string? EmpresaCode = null,
    string? EstabelecimentoCode = null,
    string? EstabelecimentoName = null,
    IReadOnlyList<CategoriaSalarialStepResponse>? Steps = null
);

public sealed record CategoriaSalarialLookupItem(
    Guid Id,
    string Code,
    string Description,
    string DisplayLabel
);

/// <summary>Item para importação em lote de categorias salariais.</summary>
public sealed record CategoriaSalarialImportItem(
    [Required, MaxLength(10)] string Code,
    [Required, MaxLength(120)] string Description,
    bool IsActive,
    decimal? ValorBase,
    string? EmpresaCodigo,
    string? EstabelecimentoCodigo
);

public sealed record CategoriaSalarialImportResult(int Created, int Updated, int Skipped, IReadOnlyList<string> Errors);
