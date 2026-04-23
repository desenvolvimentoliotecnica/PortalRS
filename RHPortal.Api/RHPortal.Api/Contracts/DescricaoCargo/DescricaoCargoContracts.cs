using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.DescricaoCargo;

/// <summary>
/// Item estruturado da DescricaoCargo (atividade, vivência, competência, requisito).
/// Categoria define o "balde" no template DNALIO.
/// </summary>
public sealed record DescricaoCargoItemRequest(
    DescricaoCargoItemCategoria Categoria,
    [Required, MaxLength(500)] string Texto,
    bool IsObrigatoria,
    [MaxLength(40)] string? NivelMinimo,
    [MaxLength(80)] string? Subcategoria,
    int Ordem
);

public sealed record DescricaoCargoItemResponse(
    Guid Id,
    DescricaoCargoItemCategoria Categoria,
    string Texto,
    bool IsObrigatoria,
    string? NivelMinimo,
    string? Subcategoria,
    int Ordem
);

public sealed record DescricaoCargoCreateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(200)] string Title,
    [MaxLength(120)] string? AreaTemplate,
    [MaxLength(20)] string? CboCodigo,
    [MaxLength(2000)] string? Summary,
    // Formação
    [MaxLength(200)] string? FormacaoMinima,
    [MaxLength(200)] string? FormacaoDesejavel,
    [MaxLength(200)] string? FormacaoAreaEstudo,
    // Experiência
    [MaxLength(80)] string? ExperienciaTempoMinimo,
    [MaxLength(80)] string? ExperienciaTempoDesejavel,
    [MaxLength(500)] string? ExperienciaEspecificacao,
    // Revisão
    [MaxLength(10)] string? RevisaoNumero,
    DateOnly? RevisaoData,
    [MaxLength(200)] string? RevisaoNatureza,
    [MaxLength(200)] string? GestorNome,
    [MaxLength(200)] string? GestorEmail,
    // HTML legados (apresentação pública)
    string? Responsibilities,
    string? Requirements,
    string? NiceToHave,
    string? Benefits,
    // Itens estruturados (template DNALIO)
    IReadOnlyList<DescricaoCargoItemRequest>? Itens,
    bool IsTemplate,
    bool IsActive,
    Guid? NivelCargoId = null
);

public sealed record DescricaoCargoUpdateRequest(
    [Required, MaxLength(30)] string Code,
    [Required, MaxLength(200)] string Title,
    [MaxLength(120)] string? AreaTemplate,
    [MaxLength(20)] string? CboCodigo,
    [MaxLength(2000)] string? Summary,
    [MaxLength(200)] string? FormacaoMinima,
    [MaxLength(200)] string? FormacaoDesejavel,
    [MaxLength(200)] string? FormacaoAreaEstudo,
    [MaxLength(80)] string? ExperienciaTempoMinimo,
    [MaxLength(80)] string? ExperienciaTempoDesejavel,
    [MaxLength(500)] string? ExperienciaEspecificacao,
    [MaxLength(10)] string? RevisaoNumero,
    DateOnly? RevisaoData,
    [MaxLength(200)] string? RevisaoNatureza,
    [MaxLength(200)] string? GestorNome,
    [MaxLength(200)] string? GestorEmail,
    string? Responsibilities,
    string? Requirements,
    string? NiceToHave,
    string? Benefits,
    /// <summary>Lista completa de itens. Servidor faz pattern "replace" — substitui
    /// todos os itens existentes pelos enviados (igual a CategoriaSalarial.Steps).</summary>
    IReadOnlyList<DescricaoCargoItemRequest>? Itens,
    bool IsTemplate,
    bool IsActive,
    Guid? NivelCargoId = null
);

public sealed record DescricaoCargoResponse(
    Guid Id,
    string Code,
    string Title,
    string? AreaTemplate,
    string? CboCodigo,
    string? Summary,
    string? FormacaoMinima,
    string? FormacaoDesejavel,
    string? FormacaoAreaEstudo,
    string? ExperienciaTempoMinimo,
    string? ExperienciaTempoDesejavel,
    string? ExperienciaEspecificacao,
    string? RevisaoNumero,
    DateOnly? RevisaoData,
    string? RevisaoNatureza,
    string? GestorNome,
    string? GestorEmail,
    string? Responsibilities,
    string? Requirements,
    string? NiceToHave,
    string? Benefits,
    bool IsTemplate,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    Guid? NivelCargoId,
    string? NivelCargoNome,
    IReadOnlyList<DescricaoCargoItemResponse> Itens
);

public sealed record DescricaoCargoLookupItem(
    Guid Id,
    string Code,
    string Title,
    string DisplayLabel,
    bool IsTemplate
);
