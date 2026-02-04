using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class EmailConfig : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    [MaxLength(20)]
    public string Provider { get; set; } = "smtp";

    [MaxLength(200)]
    public string? SmtpHost { get; set; }

    public int SmtpPort { get; set; } = 587;

    public bool SmtpEnableSsl { get; set; } = true;

    [MaxLength(200)]
    public string? SmtpUserName { get; set; }

    public string? SmtpPasswordEncrypted { get; set; }

    [MaxLength(200)]
    public string? SmtpFromName { get; set; }

    [MaxLength(200)]
    public string? SmtpFromAddress { get; set; }

    [MaxLength(200)]
    public string? ImapHost { get; set; }

    public int ImapPort { get; set; } = 993;

    public bool ImapEnableSsl { get; set; } = true;

    [MaxLength(200)]
    public string? ImapUserName { get; set; }

    public string? ImapPasswordEncrypted { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
