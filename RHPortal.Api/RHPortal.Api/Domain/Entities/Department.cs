using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class Department : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public string Code { get; set; } = default!;          // "DEP-XXX"
    public string Name { get; set; } = default!;          // "Produção"

    public Guid? AreaId { get; set; }                     // dropdown "Área vinculada"
    public Area? Area { get; set; }

    public DepartmentStatus Status { get; set; } = DepartmentStatus.Active;
    public int Headcount { get; set; }

    public string? ManagerName { get; set; }              // "Gestor" (por enquanto texto)
    public string? ManagerEmail { get; set; }

    public string? Phone { get; set; }
    public string? BranchOrLocation { get; set; }

    public string? Description { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
