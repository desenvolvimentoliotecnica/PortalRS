using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Feedback;

public sealed record FeedbackCreateRequest(
    [Required] Guid ToUserId,
    [Required, MinLength(1), MaxLength(4000)] string Content,
    [MaxLength(40)] string? Tipo = null,
    bool IsPresencial = false,
    [MaxLength(4000)] string? InternalNotes = null,
    List<FeedbackRatingInput>? Ratings = null);

public sealed record FeedbackRatingInput(
    [Required, MaxLength(120)] string ItemName,
    [Range(1, 5)] int Stars);

public sealed record FeedbackItemResponse(
    Guid Id,
    Guid FromUserId,
    string FromUserFullName,
    Guid ToUserId,
    string ToUserFullName,
    string Content,
    string? Tipo,
    bool IsPresencial,
    string? InternalNotes,
    IReadOnlyList<FeedbackRatingResponse> Ratings,
    DateTimeOffset CreatedAtUtc);

public sealed record FeedbackRatingResponse(string ItemName, int Stars);

public sealed record FeedbackListResponse(
    IReadOnlyList<FeedbackItemResponse> Items,
    int TotalCount,
    int Page,
    int PageSize);
