namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Nível hierárquico customizável pelo Admin. Exemplos: "Presidente", "Diretor", "Gerente", "Coordenador".
/// Ordem 0 = nível mais alto. Totalmente personalizável por tenant.
/// </summary>
public sealed class NivelHierarquico : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Nome livre definido pelo Admin. Ex: "VP de Operações", "Head de Área".</summary>
    public string Nome { get; set; } = default!;

    /// <summary>Ordem numérica (0 = mais alto na hierarquia).</summary>
    public int Ordem { get; set; }

    public bool Ativo { get; set; } = true;

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
