namespace RhPortal.Api.Domain.Entities;

public sealed class AgendaEvent : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid TypeId { get; set; }
    public AgendaEventType? Type { get; set; }

    public string Title { get; set; } = default!;
    public DateTime StartAtUtc { get; set; }
    public DateTime EndAtUtc { get; set; }
    public bool AllDay { get; set; }

    public string Status { get; set; } = "confirmado";
    public string? Location { get; set; }
    public string? Owner { get; set; }
    public string? Candidate { get; set; }
    public string? VagaTitle { get; set; }
    public string? VagaCode { get; set; }
    public string? Notes { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
