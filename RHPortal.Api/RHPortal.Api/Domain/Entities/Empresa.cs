using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class Empresa : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    [MaxLength(30)]
    public string Code { get; set; } = default!;        // Código único por tenant

    [MaxLength(120)]
    public string Description { get; set; } = default!;

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
