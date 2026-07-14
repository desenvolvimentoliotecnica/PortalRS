using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Emails;

public sealed record EmailTemplateListItem(
    Guid Id,
    string Name,
    string DisplayName,
    string Description,
    int Version,
    bool IsActive,
    bool IsCustomized,
    string SubjectTemplate,
    IReadOnlyList<string> Tags,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed record EmailTemplateResponse(
    Guid Id,
    string Name,
    string DisplayName,
    string Description,
    int Version,
    bool IsActive,
    bool IsCustomized,
    string SubjectTemplate,
    string BodyHtml,
    string SubjectDefault,
    string BodyHtmlDefault,
    IReadOnlyList<string> Tags,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed record EmailTemplateCreateRequest(
    [Required, MaxLength(120)] string Name,
    [Required, MaxLength(200)] string SubjectTemplate,
    [Required] string BodyHtml);

public sealed record EmailTemplateUpdateRequest(
    [Required, MaxLength(200)] string SubjectTemplate,
    [Required] string BodyHtml);

public sealed record EmailTemplateAssetUploadResponse(
    string Url,
    string ContentType,
    long SizeBytes);
