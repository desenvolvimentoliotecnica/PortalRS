using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.CategoriaSalarial;

public sealed record CategoriaSalarialCreateRequest(
    [Required, MaxLength(10)] string Code,
    [Required, MaxLength(120)] string Description,
    bool IsActive,
    Guid? EmpresaId = null,
    Guid? EstabelecimentoId = null
);

public sealed record CategoriaSalarialUpdateRequest(
    [Required, MaxLength(10)] string Code,
    [Required, MaxLength(120)] string Description,
    bool IsActive,
    Guid? EmpresaId = null,
    Guid? EstabelecimentoId = null
);

public sealed record CategoriaSalarialResponse(
    Guid Id,
    string Code,
    string Description,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    Guid? EmpresaId = null,
    Guid? EstabelecimentoId = null,
    string? EmpresaCode = null,
    string? EstabelecimentoCode = null,
    string? EstabelecimentoName = null
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
    string? EmpresaCodigo,
    string? EstabelecimentoCodigo
);

public sealed record CategoriaSalarialImportResult(int Created, int Updated, int Skipped, IReadOnlyList<string> Errors);
