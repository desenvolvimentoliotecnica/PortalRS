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
    DateOnly? ValidUntil = null,
    Guid? ParentId = null,
    // Campos absorvidos de Department (Sessão 31.2)
    int Headcount = 0,
    [MaxLength(40)] string? Phone = null,
    [MaxLength(160)] string? BranchOrLocation = null,
    // Campo absorvido de Area
    Guid? OwnerFuncionarioId = null,
    [MaxLength(1000)] string? Description2 = null
);

public sealed record CentroCustoUpdateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(120)] string? Manager,
    [MaxLength(500)] string? Notes,
    bool IsActive,
    Guid? EmpresaId = null,
    DateOnly? ValidFrom = null,
    DateOnly? ValidUntil = null,
    Guid? ParentId = null,
    // Campos absorvidos de Department (Sessão 31.2)
    int Headcount = 0,
    [MaxLength(40)] string? Phone = null,
    [MaxLength(160)] string? BranchOrLocation = null,
    // Campo absorvido de Area
    Guid? OwnerFuncionarioId = null,
    [MaxLength(1000)] string? Description2 = null
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
    DateOnly? ValidUntil = null,
    Guid? ParentId = null,
    string? ParentCode = null,
    string? ParentDescription = null,
    // Campos absorvidos de Department (Sessão 31.2)
    int Headcount = 0,
    string? Phone = null,
    string? BranchOrLocation = null,
    // Campo absorvido de Area
    Guid? OwnerFuncionarioId = null,
    string? OwnerFuncionarioName = null,
    string? Description2 = null,
    // Headcount derivado em runtime — formato "ativos/orçado".
    // Orçado = ativos + headcount pendente das vagas abertas vinculadas ao CC.
    int HeadcountAtivos = 0,
    int HeadcountOrcado = 0
);

/// <summary>Nó da árvore hierárquica de centros de custo.</summary>
public sealed record CentroCustoTreeNode(
    Guid Id,
    string Code,
    string Description,
    bool IsActive,
    Guid? EmpresaId,
    string? EmpresaCode,
    IReadOnlyList<CentroCustoTreeNode> Children
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
