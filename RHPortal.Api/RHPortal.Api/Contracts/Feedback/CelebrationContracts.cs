using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Feedback;

public sealed record CelebrationCreateRequest(
    [Required, MinLength(1), MaxLength(4000)] string Content,
    // Opcional. Frontends antigos podem mandar [] ou nulls dentro do array (quando o
    // matching de @menção não encontra ninguém) — o service filtra valores inválidos
    // antes de persistir, então aqui é tolerante por design.
    IReadOnlyList<Guid?>? MentionedUserIds);

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

public sealed record CelebrationCommentCreateRequest(
    [Required, MinLength(1), MaxLength(2000)] string Content,
    // Tolerante a [], [null] e nulls dentro do array — mesma motivação de CelebrationCreateRequest.
    IReadOnlyList<Guid?>? MentionedUserIds);

public sealed record CelebrationCommentMentionResponse(Guid UserId, string FullName);

public sealed record CelebrationCommentReactionSummaryResponse(string Type, int Count, bool ReactedByMe);

public sealed record CelebrationCommentResponse(
    Guid Id,
    Guid PostId,
    Guid AuthorId,
    string AuthorFullName,
    string Content,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyList<CelebrationCommentMentionResponse> Mentions,
    IReadOnlyList<CelebrationCommentReactionSummaryResponse> Reactions);

public sealed record CelebrationCommentsListResponse(
    IReadOnlyList<CelebrationCommentResponse> Items,
    int TotalCount,
    int Page,
    int PageSize);

public sealed record CelebrationCommentReactionToggleRequest(
    [Required, MinLength(1), MaxLength(20)] string Type);
