using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class EmailMessage : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    [MaxLength(120)]
    public string? OwnerUserId { get; set; }

    [MaxLength(200)]
    public string? OwnerUserName { get; set; }

    public bool IsSystem { get; set; }

    [MaxLength(120)]
    public string? Source { get; set; }

    [Required, MaxLength(320)]
    public string To { get; set; } = string.Empty;

    [MaxLength(640)]
    public string? Cc { get; set; }

    [MaxLength(640)]
    public string? Bcc { get; set; }

    [Required, MaxLength(260)]
    public string Subject { get; set; } = string.Empty;

    public string BodyHtml { get; set; } = string.Empty;

    public string? BodyText { get; set; }

    public Guid? TemplateId { get; set; }

    [MaxLength(120)]
    public string? TemplateName { get; set; }

    public int? TemplateVersion { get; set; }

    public string? PayloadJson { get; set; }

    public EmailMessageStatus Status { get; set; } = EmailMessageStatus.Queued;

    public int AttemptCount { get; set; }

    public int MaxAttempts { get; set; } = 3;

    public DateTimeOffset? NextAttemptAtUtc { get; set; }

    [MaxLength(1200)]
    public string? LastError { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public List<EmailAttempt> Attempts { get; set; } = new();
    public List<EmailMessageAttachment> Attachments { get; set; } = new();
}

public sealed class EmailMessageAttachment : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid EmailMessageId { get; set; }
    public EmailMessage? EmailMessage { get; set; }

    [Required, MaxLength(260)]
    public string FileName { get; set; } = string.Empty;

    [MaxLength(160)]
    public string? ContentType { get; set; }

    public long SizeBytes { get; set; }

    public byte[] ContentBytes { get; set; } = Array.Empty<byte>();

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class EmailAttempt : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid EmailMessageId { get; set; }
    public EmailMessage? EmailMessage { get; set; }

    public int AttemptNumber { get; set; }

    [MaxLength(40)]
    public string Provider { get; set; } = string.Empty;

    public DateTimeOffset StartedAtUtc { get; set; }
    public DateTimeOffset? CompletedAtUtc { get; set; }

    public bool IsSuccess { get; set; }

    [MaxLength(1200)]
    public string? ErrorMessage { get; set; }

    [MaxLength(2000)]
    public string? ErrorStackTrace { get; set; }
}

public sealed class EmailTemplate : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    [Required, MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string SubjectTemplate { get; set; } = string.Empty;

    public string BodyHtml { get; set; } = string.Empty;

    public int Version { get; set; } = 1;

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
