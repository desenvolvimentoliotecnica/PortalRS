using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.UnidadeLotacao;

public sealed record UnidadeLotacaoCreateRequest(
    [Required, MaxLength(10)] string CdnPlanoLotac,
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(120)] string? Location,
    [MaxLength(500)] string? Notes,
    bool IsActive,
    // Hierarquia
    Guid? ParentId,
    int Level,
    int? SequenceNumber,
    // Responsável
    Guid? OwnerFuncionarioId,
    // TOTVS
    [MaxLength(10)] string? CdnPlanoLotac
);

public sealed record UnidadeLotacaoUpdateRequest(
    [Required, MaxLength(10)] string CdnPlanoLotac,
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(120)] string? Location,
    [MaxLength(500)] string? Notes,
    bool IsActive,
    // Hierarquia
    Guid? ParentId,
    int Level,
    int? SequenceNumber,
    // Responsável
    Guid? OwnerFuncionarioId,
    // TOTVS
    [MaxLength(10)] string? CdnPlanoLotac
);

public sealed record UnidadeLotacaoResponse(
    Guid Id,
    string CdnPlanoLotac,
    string Code,
    string Description,
    string? Location,
    string? Notes,
    bool IsActive,
    // Hierarquia
    Guid? ParentId,
    string? ParentCode,
    string? ParentDescription,
    int Level,
    int CalculatedLevel,
    int? SequenceNumber,
    // Responsável
    Guid? OwnerFuncionarioId,
    string? OwnerFuncionarioName,
    string? OwnerCdnEmpresa,
    string? OwnerCdnEstab,
    string? OwnerCdnFuncionario,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record UnidadeLotacaoLookupItem(
    Guid Id,
    string Code,
    string Description,
    string DisplayLabel
);

/// <summary>Item para importação em lote de unidades de lotação.</summary>
public sealed record UnidadeLotacaoImportItem(
    [Required, MaxLength(10)]  string CdnPlanoLotac,
    [Required, MaxLength(30)]  string Code,
    [Required, MaxLength(120)] string Description,
    [MaxLength(120)] string? Location,
    [MaxLength(500)] string? Notes,
    bool IsActive,
    /// <summary>Código ERP da unidade pai (resolução feita no servidor; mesmo plano).</summary>
    string? ParentCodigo,
    int Level,
    int? SequenceNumber
);

public sealed record UnidadeLotacaoImportResult(int Created, int Updated, int Skipped, IReadOnlyList<string> Errors, IReadOnlyList<string> Warnings);

/// <summary>
/// Item para importação em lote de responsáveis (passo 4).
/// Vincula OwnerFuncionarioId pela chave TOTVS (CdnEmpresa + CdnEstab + CdnFuncionario).
/// </summary>
public sealed record UnidadeLotacaoOwnerImportItem(
    [Required, MaxLength(10)]  string CdnPlanoLotac,
    [Required, MaxLength(30)]  string UnitCode,
    [Required, MaxLength(3)]   string CdnEmpresa,
    [Required, MaxLength(5)]   string CdnEstab,
    [Required, MaxLength(12)]  string CdnFuncionario
);

public sealed record UnidadeLotacaoOwnerImportResult(
    int Updated,
    int UnidadeNaoEncontrada,
    int FuncionarioNaoEncontrado,
    IReadOnlyList<string> Errors
);
