namespace RhPortal.Api.Domain.Entities;

public sealed class AgendaEventType : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public string Code { get; set; } = default!;
    public string Label { get; set; } = default!;
    public string Color { get; set; } = "#6c757d";
    public string Icon { get; set; } = "bi-calendar";
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
