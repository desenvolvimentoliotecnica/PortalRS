namespace LiotecnicaHub.Web.Domain.Entities;

public class HubAccessAudit
{
    public Guid Id { get; set; }
    public Guid? AffectedUserId { get; set; }
    public Guid? ProfileId { get; set; }
    public Guid? SystemId { get; set; }
    public Guid? PermissionId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? Justification { get; set; }
    public Guid? ChangedByUserId { get; set; }
    public DateTimeOffset OccurredAtUtc { get; set; }
    public string? PreviousData { get; set; }
    public string? NewData { get; set; }
}
