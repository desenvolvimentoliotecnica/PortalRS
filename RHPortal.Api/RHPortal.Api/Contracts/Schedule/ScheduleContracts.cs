using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Schedule;

public sealed record ScheduleEventTypeResponse(
    Guid Id,
    string Code,
    string Label,
    string Color,
    string Icon,
    int SortOrder,
    bool IsActive
);

public sealed record ScheduleEventResponse(
    Guid Id,
    string Title,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    bool AllDay,
    string Status,
    string? Location,
    string? Owner,
    string? Candidate,
    string? VagaTitle,
    string? VagaCode,
    string? Notes,
    Guid? CandidaturaId,
    Guid? CandidatoId,
    Guid? VagaId,
    string? CandidateResponseStatus,
    DateTimeOffset? CandidateRespondedAtUtc,
    DateTime? CandidateSuggestedStartAtUtc,
    DateTime? CandidateSuggestedEndAtUtc,
    string? CandidateResponseMessage,
    string? CandidateConfirmationToken,
    string TypeCode,
    string TypeLabel,
    string TypeColor,
    string TypeIcon
);

public sealed record ScheduleEventsQuery(
    DateTime? Start,
    DateTime? End,
    string? Search,
    string? Type,
    string? Status
);

public sealed record ScheduleEventCreateRequest(
    [Required, MaxLength(240)] string Title,
    [Required] DateTime StartAtUtc,
    [Required] DateTime EndAtUtc,
    bool AllDay,
    [Required, MaxLength(40)] string Status,
    [MaxLength(160)] string? Location,
    [MaxLength(120)] string? Owner,
    [MaxLength(160)] string? Candidate,
    [MaxLength(200)] string? VagaTitle,
    [MaxLength(40)] string? VagaCode,
    [MaxLength(2000)] string? Notes,
    [Required, MaxLength(40)] string TypeCode
);

public sealed record ScheduleEventUpdateRequest(
    [Required, MaxLength(240)] string Title,
    [Required] DateTime StartAtUtc,
    [Required] DateTime EndAtUtc,
    bool AllDay,
    [Required, MaxLength(40)] string Status,
    [MaxLength(160)] string? Location,
    [MaxLength(120)] string? Owner,
    [MaxLength(160)] string? Candidate,
    [MaxLength(200)] string? VagaTitle,
    [MaxLength(40)] string? VagaCode,
    [MaxLength(2000)] string? Notes,
    [Required, MaxLength(40)] string TypeCode
);

public sealed record PublicInterviewResponse(
    Guid Id,
    string Title,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    string Status,
    string? Location,
    string? Owner,
    string? Candidate,
    string? VagaTitle,
    string? VagaCode,
    string? CandidateResponseStatus,
    DateTimeOffset? CandidateRespondedAtUtc,
    DateTime? CandidateSuggestedStartAtUtc,
    DateTime? CandidateSuggestedEndAtUtc,
    string? CandidateResponseMessage
);

public sealed record SuggestInterviewTimeRequest(
    [Required] DateTime SuggestedStartAtUtc,
    [Required] DateTime SuggestedEndAtUtc,
    [MaxLength(1000)] string? Message
);
