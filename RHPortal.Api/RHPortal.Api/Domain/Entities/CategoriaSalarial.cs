namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Categoria Salarial para integração TOTVS.
/// Baseado em apisfaltcategoria.p do Protheus.
///
/// A entidade representa a grade salarial de um cargo — define um
/// <see cref="ValorBase"/> (salário de referência em 100%) e uma coleção de
/// <see cref="CategoriaSalarialStep"/> (degraus percentuais: ex. 80%, 85%, …, 120%).
/// O valor de cada step é normalmente calculado (ValorBase × Percentual/100) mas
/// pode ser sobrescrito individualmente — a grade é livre para cadastro.
/// </summary>
public sealed class CategoriaSalarial : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código da categoria (1-5 ou A-E, ou livre: "Dev Senior BE")</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(10)]
    public string Code { get; set; } = default!;

    /// <summary>Descrição da categoria</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(120)]
    public string Description { get; set; } = default!;

    /// <summary>
    /// Salário de referência (100%) sobre o qual os percentuais da grade são
    /// aplicados. Null permite começar a cadastrar a categoria sem ainda ter
    /// definido o valor-base (fica como rascunho). Precisão: decimal(18,2).
    /// </summary>
    public decimal? ValorBase { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    public Guid? EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }

    public Guid? EstabelecimentoId { get; set; }
    public Unit? Estabelecimento { get; set; }

    /// <summary>Degraus da grade percentual. Cascade em delete — steps morrem junto com a categoria.</summary>
    public ICollection<CategoriaSalarialStep> Steps { get; set; } = new List<CategoriaSalarialStep>();
}
