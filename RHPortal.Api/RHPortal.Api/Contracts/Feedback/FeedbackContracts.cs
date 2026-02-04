using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Feedback;

public sealed record FeedbackCreateRequest(
    [Required] Guid ToUserId,
    [Required, MinLength(1), MaxLength(4000)] string Content,
    [MaxLength(40)] string? Tipo = null);

public sealed record FeedbackItemResponse(
    Guid Id,
    Guid FromUserId,
    string FromUserFullName,
    Guid ToUserId,
    string ToUserFullName,
    string Content,
    string? Tipo,
    DateTimeOffset CreatedAtUtc);

public sealed record FeedbackListResponse(
    IReadOnlyList<FeedbackItemResponse> Items,
    int TotalCount,
    int Page,
    int PageSize);
