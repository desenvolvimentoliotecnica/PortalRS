using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.CentroCusto;

public sealed record CentroCustoCreateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(120)] string? Manager,
    [MaxLength(500)] string? Notes,
    bool IsActive,
    Guid? EmpresaId = null,
    DateOnly? ValidFrom = null,
    DateOnly? ValidUntil = null
);

public sealed record CentroCustoUpdateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(120)] string? Manager,
    [MaxLength(500)] string? Notes,
    bool IsActive,
    Guid? EmpresaId = null,
    DateOnly? ValidFrom = null,
    DateOnly? ValidUntil = null
);

public sealed record CentroCustoResponse(
    Guid Id,
    string Code,
    string Description,
    string? Manager,
    string? Notes,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    Guid? EmpresaId = null,
    string? EmpresaCode = null,
    string? EmpresaDescription = null,
    DateOnly? ValidFrom = null,
    DateOnly? ValidUntil = null
);

public sealed record CentroCustoLookupItem(
    Guid Id,
    string Code,
    string Description,
    string DisplayLabel
);

/// <summary>Item para importação em lote de centros de custo.</summary>
public sealed record CentroCustoImportItem(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(120)] string? Manager,
    bool IsActive,
    /// <summary>Código ERP da empresa (resolução feita no servidor).</summary>
    string? EmpresaCodigo,
    string? ValidFrom,
    string? ValidUntil
);

public sealed record CentroCustoImportResult(int Created, int Updated, int Skipped, IReadOnlyList<string> Errors);
