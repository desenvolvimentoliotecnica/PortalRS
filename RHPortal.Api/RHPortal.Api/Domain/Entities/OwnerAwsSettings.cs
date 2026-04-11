using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class OwnerAwsSettings
{
    public Guid Id { get; set; }

    /// <summary>Access Key ID criptografado com AES-256.</summary>
    public string? AccessKeyIdEncrypted { get; set; }

    /// <summary>Secret Access Key criptografado com AES-256.</summary>
    public string? SecretAccessKeyEncrypted { get; set; }

    [MaxLength(50)]
    public string? Region { get; set; }

    [MaxLength(200)]
    public string? BucketName { get; set; }

    /// <summary>Tempo de expiração das presigned URLs em minutos. Default: 15.</summary>
    public int PresignedUrlExpirationMinutes { get; set; } = 15;

    public DateTimeOffset UpdatedAtUtc { get; set; }
}
