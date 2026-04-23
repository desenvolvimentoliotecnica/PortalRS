namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Um degrau (step) na grade percentual de uma <see cref="CategoriaSalarial"/>.
///
/// Modelo: o cargo tem uma Categoria Salarial que define um <c>ValorBase</c>
/// (salário de referência em 100%). A categoria então exibe uma grade de
/// percentuais (ex.: 80%, 85%, 90%, …, 120%) — cada percentual é um step.
///
/// O valor de cada step é normalmente calculado (<c>ValorBase × Percentual/100</c>),
/// mas pode ser sobrescrito via <see cref="ValorOverride"/> para permitir ajuste
/// manual (o usuário pediu "livre para cadastro"). O frontend usa override quando
/// presente; caso contrário calcula.
/// </summary>
public sealed class CategoriaSalarialStep : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CategoriaSalarialId { get; set; }
    public CategoriaSalarial? CategoriaSalarial { get; set; }

    /// <summary>
    /// Percentual da grade (ex.: 80, 85, 120). Aceita casas decimais caso a
    /// política use steps fracionados (ex.: 82.5). Precisão: 2 casas.
    /// </summary>
    public decimal Percentual { get; set; }

    /// <summary>
    /// Valor do step. Se <c>null</c>, o frontend calcula como
    /// <c>CategoriaSalarial.ValorBase × Percentual / 100</c>. Se preenchido,
    /// prevalece — útil para casos em que a grade não é estritamente linear.
    /// </summary>
    public decimal? ValorOverride { get; set; }

    /// <summary>Ordem de exibição na grade (crescente). Normalmente alinhado ao percentual.</summary>
    public int Ordem { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(200)]
    public string? Observacao { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
