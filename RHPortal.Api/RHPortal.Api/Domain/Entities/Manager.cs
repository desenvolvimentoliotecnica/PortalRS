using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class Manager : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public string Name { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string? Phone { get; set; }

    public ManagerStatus Status { get; set; } = ManagerStatus.Active;

    // Relações (como no seu form: Unidade, Área, Cargo)
    public Guid UnitId { get; set; }
    public Unit? Unit { get; set; }

    public Guid AreaId { get; set; }
    public Area? Area { get; set; }

    public int Headcount { get; set; }

    public Guid JobPositionId { get; set; }
    public JobPosition? JobPosition { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
