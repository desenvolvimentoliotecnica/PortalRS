using System.ComponentModel.DataAnnotations;
using System;
using System.Collections.Generic;

namespace RhPortal.Api.Contracts.Feedback;

public sealed record SurveySummaryResponse(
    Guid Id,
    string Title,
    string? Type,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? StartAtUtc,
    DateTimeOffset? EndAtUtc,
    int ResponsesCount);

public sealed record SurveyCreateRequest(
    [Required, MinLength(1), MaxLength(240)] string Title,
    [MaxLength(40)] string? Type = null,
    DateTimeOffset? StartAtUtc = null,
    DateTimeOffset? EndAtUtc = null,
    string? DepartmentsJson = null);

public sealed record SurveyResponseRequest(
    Guid UserId,
    IReadOnlyList<SurveyAnswerDto> Answers);

public sealed record SurveyAnswerDto(
    Guid QuestionId,
    Guid? OptionId,
    string? TextAnswer);

public sealed record SurveyListResponse(IReadOnlyList<SurveySummaryResponse> Items, int TotalCount, int Page, int PageSize);

