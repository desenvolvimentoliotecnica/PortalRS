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

    /// <summary>online | presencial | hibrido</summary>
    public string? MeetingFormat { get; set; }

    /// <summary>E-mail da sala (room mailbox) no Microsoft 365.</summary>
    public string? RoomEmail { get; set; }

    public string? RoomDisplayName { get; set; }

    public string? Owner { get; set; }
    public string? Candidate { get; set; }
    public string? VagaTitle { get; set; }
    public string? VagaCode { get; set; }
    public string? Notes { get; set; }

    public Guid? CandidaturaId { get; set; }
    public Guid? CandidatoId { get; set; }
    public Guid? VagaId { get; set; }

    public string? CandidateConfirmationToken { get; set; }
    public string? CandidateResponseStatus { get; set; }
    public DateTimeOffset? CandidateRespondedAtUtc { get; set; }
    public DateTime? CandidateSuggestedStartAtUtc { get; set; }
    public DateTime? CandidateSuggestedEndAtUtc { get; set; }
    public string? CandidateResponseMessage { get; set; }

    /// <summary>ID do evento no Microsoft Graph (Outlook), quando sincronizado.</summary>
    public string? GraphCalendarEventId { get; set; }

    /// <summary>UPN do calendário onde o evento foi criado no Graph.</summary>
    public string? GraphCalendarUserUpn { get; set; }

    /// <summary>Link de ingresso Teams quando o evento é reunião online sincronizada com Outlook.</summary>
    public string? OnlineMeetingJoinUrl { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
