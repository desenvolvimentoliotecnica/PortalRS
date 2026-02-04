namespace RhPortal.Api.Domain.Entities;

public sealed class Area : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Área pai na hierarquia organizacional (null = raiz).</summary>
    public Guid? ParentId { get; set; }
    public Area? Parent { get; set; }
    public ICollection<Area>? Children { get; set; }

    /// <summary>Funcionário responsável (dono) desta área.</summary>
    public Guid? OwnerFuncionarioId { get; set; }
    public Funcionario? OwnerFuncionario { get; set; }
}
