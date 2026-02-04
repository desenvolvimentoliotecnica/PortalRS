using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Feedback;

public sealed record OneOnOneCreateRequest(
    [Required] Guid CollaboratorId,
    [Required] DateTimeOffset MeetingDate,
    [MaxLength(200)] string? Subject = null,
    [MaxLength(4000)] string? Notes = null);

public sealed record OneOnOneUpdateRequest(
    DateTimeOffset MeetingDate,
    [MaxLength(200)] string? Subject = null,
    [MaxLength(4000)] string? Notes = null);

public sealed record OneOnOneMeetingResponse(
    Guid Id,
    Guid ManagerId,
    string ManagerFullName,
    Guid CollaboratorId,
    string CollaboratorFullName,
    DateTimeOffset MeetingDate,
    string? Subject,
    string? Notes,
    DateTimeOffset CreatedAtUtc);

public sealed record OneOnOneListResponse(
    IReadOnlyList<OneOnOneMeetingResponse> Items,
    int TotalCount,
    int Page,
    int PageSize);
