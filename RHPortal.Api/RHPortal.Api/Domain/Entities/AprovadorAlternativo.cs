namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Registra um aprovador substituto para um gestor durante um período de vigência.
/// Quando ativo, o workflow de aprovação substitui automaticamente o gestor pelo aprovador alternativo.
/// </summary>
public sealed class AprovadorAlternativo : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Gestor que está sendo substituído.</summary>
    public Guid GestorId { get; set; }
    public Funcionario? Gestor { get; set; }

    /// <summary>Funcionário que aprovará no lugar do gestor durante a vigência.</summary>
    public Guid AprovadorId { get; set; }
    public Funcionario? Aprovador { get; set; }

    /// <summary>Data de início da vigência (inclusive).</summary>
    public DateOnly DataInicio { get; set; }

    /// <summary>Data de fim da vigência (inclusive). Null = sem data fim definida.</summary>
    public DateOnly? DataFim { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
