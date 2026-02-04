using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Emails;

public sealed record EmailTemplateListItem(
    Guid Id,
    string Name,
    int Version,
    bool IsActive,
    string SubjectTemplate,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed record EmailTemplateResponse(
    Guid Id,
    string Name,
    int Version,
    bool IsActive,
    string SubjectTemplate,
    string BodyHtml,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed record EmailTemplateCreateRequest(
    [Required, MaxLength(120)] string Name,
    [Required, MaxLength(200)] string SubjectTemplate,
    [Required] string BodyHtml);

public sealed record EmailTemplateUpdateRequest(
    [Required, MaxLength(200)] string SubjectTemplate,
    [Required] string BodyHtml);
