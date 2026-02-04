using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Feedback;

public sealed record DevelopmentPlanCreateRequest(
    [Required, MaxLength(200)] string Title,
    [MaxLength(2000)] string? Description,
    Guid? TargetUserId);

public sealed record DevelopmentPlanUpdateRequest(
    [Required, MaxLength(200)] string Title,
    [MaxLength(2000)] string? Description);

public sealed record DevelopmentPlanGoalCreateRequest(
    [Required, MaxLength(500)] string Description,
    DateTimeOffset? DueDate,
    int Order = 0);

public sealed record DevelopmentPlanGoalUpdateRequest(
    [Required, MaxLength(500)] string Description,
    DateTimeOffset? DueDate,
    DateTimeOffset? ConcludedAt,
    int Order);

public sealed record DevelopmentPlanGoalResponse(
    Guid Id,
    string Description,
    DateTimeOffset? DueDate,
    DateTimeOffset? ConcludedAt,
    int Order);

public sealed record DevelopmentPlanResponse(
    Guid Id,
    Guid OwnerUserId,
    string OwnerUserFullName,
    Guid? TargetUserId,
    string? TargetUserFullName,
    string Title,
    string? Description,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    IReadOnlyList<DevelopmentPlanGoalResponse> Goals);

public sealed record DevelopmentPlanListResponse(
    IReadOnlyList<DevelopmentPlanResponse> Items,
    int TotalCount,
    int Page,
    int PageSize);
