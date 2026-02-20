using System;
using System.Collections.Generic;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Domain.Entities;

public sealed class Survey : ITenantEntity
{
    public Guid Id { get; set; }
    public string? TenantId { get; set; }
    public string Title { get; set; } = null!;
    public string? Type { get; set; } // e.g. Rapida, Super, Engajamento
    public DateTimeOffset? StartAtUtc { get; set; }
    public DateTimeOffset? EndAtUtc { get; set; }
    public string? DepartmentsJson { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public IList<SurveyQuestion> Questions { get; set; } = new List<SurveyQuestion>();
    public IList<SurveyResponse> Responses { get; set; } = new List<SurveyResponse>();
}

public sealed class SurveyQuestion : ITenantEntity
{
    public Guid Id { get; set; }
    public string? TenantId { get; set; }
    public Guid SurveyId { get; set; }
    public Survey? Survey { get; set; }
    public string Text { get; set; } = null!;
    public string? Type { get; set; } // Text, SingleChoice, MultiChoice
    public int Order { get; set; }
    public IList<SurveyOption> Options { get; set; } = new List<SurveyOption>();
}

public sealed class SurveyOption : ITenantEntity
{
    public Guid Id { get; set; }
    public string? TenantId { get; set; }
    public Guid QuestionId { get; set; }
    public SurveyQuestion? Question { get; set; }
    public string Text { get; set; } = null!;
    public int Order { get; set; }
}

public sealed class SurveyResponse : ITenantEntity
{
    public Guid Id { get; set; }
    public string? TenantId { get; set; }
    public Guid SurveyId { get; set; }
    public Survey? Survey { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset SubmittedAtUtc { get; set; }
    public IList<SurveyAnswer> Answers { get; set; } = new List<SurveyAnswer>();
}

public sealed class SurveyAnswer : ITenantEntity
{
    public Guid Id { get; set; }
    public string? TenantId { get; set; }
    public Guid ResponseId { get; set; }
    public SurveyResponse? Response { get; set; }
    public Guid QuestionId { get; set; }
    public Guid? OptionId { get; set; }
    public string? TextAnswer { get; set; }
}

