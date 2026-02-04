using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Feedback;

public sealed record CelebrationCreateRequest(
    [Required, MinLength(1), MaxLength(4000)] string Content,
    [Required] IReadOnlyList<Guid> MentionedUserIds);

public sealed record CelebrationPostResponse(
    Guid Id,
    Guid AuthorId,
    string AuthorFullName,
    string Content,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyList<CelebrationMentionResponse> Mentions);

public sealed record CelebrationMentionResponse(Guid UserId, string FullName);

public sealed record CelebrationFeedResponse(
    IReadOnlyList<CelebrationPostResponse> Items,
    int TotalCount,
    int Page,
    int PageSize);

public sealed record CelebrationMentionUserResponse(Guid Id, string FullName, string? Email);
