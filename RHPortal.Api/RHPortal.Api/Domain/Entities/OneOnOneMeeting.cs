using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class OneOnOneMeeting : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid ManagerId { get; set; }
    public ApplicationUser? Manager { get; set; }

    public Guid CollaboratorId { get; set; }
    public ApplicationUser? Collaborator { get; set; }

    public DateTimeOffset MeetingDate { get; set; }

    [MaxLength(200)]
    public string? Subject { get; set; }

    [MaxLength(4000)]
    public string? Notes { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
}
