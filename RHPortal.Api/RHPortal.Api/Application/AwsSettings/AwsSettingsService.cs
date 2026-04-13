using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Storage;

namespace RhPortal.Api.Application.AwsSettings;

// ── DTOs ──

public sealed class AwsSettingsDto
{
    public string? AccessKeyId { get; set; }
    public string? SecretAccessKey { get; set; }
    public string? Region { get; set; }
    public string? BucketName { get; set; }
    public int PresignedUrlExpirationMinutes { get; set; } = 15;
}

/// <summary>View retornada ao frontend — credenciais mascaradas.</summary>
public sealed class AwsSettingsView
{
    /// <summary>Últimos 4 caracteres do Access Key ID, ex: "••••ABCD". Null se não configurado.</summary>
    public string? AccessKeyIdMasked { get; set; }
    public bool HasSecretAccessKey { get; set; }
    public string? Region { get; set; }
    public string? BucketName { get; set; }
    public int PresignedUrlExpirationMinutes { get; set; }
    public bool IsConfigured { get; set; }
}

// ── Interface ──

public interface IAwsSettingsService
{
    Task<AwsSettingsView> GetViewAsync(CancellationToken ct);
    Task<AwsSettingsView> SaveAsync(AwsSettingsDto dto, CancellationToken ct);
    Task<AwsOptions?> GetDecryptedAsync(CancellationToken ct);
}

// ── Implementation ──

public sealed class AwsSettingsService : IAwsSettingsService
{
    private readonly MasterDbContext _db;
    private readonly ISecretProtector _protector;
    private readonly AwsOptions _fallbackOptions;

    public AwsSettingsService(
        MasterDbContext db,
        ISecretProtector protector,
        IOptions<AwsOptions> fallbackOptions)
    {
        _db = db;
        _protector = protector;
        _fallbackOptions = fallbackOptions.Value;
    }

    public async Task<AwsSettingsView> GetViewAsync(CancellationToken ct)
    {
        var e = await _db.OwnerAwsSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);

        if (e is null)
            return new AwsSettingsView { PresignedUrlExpirationMinutes = 15 };

        var keyId = string.IsNullOrWhiteSpace(e.AccessKeyIdEncrypted)
            ? null
            : _protector.Decrypt(e.AccessKeyIdEncrypted);

        return new AwsSettingsView
        {
            AccessKeyIdMasked = Mask(keyId),
            HasSecretAccessKey = !string.IsNullOrWhiteSpace(e.SecretAccessKeyEncrypted),
            Region = e.Region,
            BucketName = e.BucketName,
            PresignedUrlExpirationMinutes = e.PresignedUrlExpirationMinutes,
            IsConfigured = !string.IsNullOrWhiteSpace(e.BucketName)
                        && !string.IsNullOrWhiteSpace(e.AccessKeyIdEncrypted)
                        && !string.IsNullOrWhiteSpace(e.SecretAccessKeyEncrypted),
        };
    }

    public async Task<AwsSettingsView> SaveAsync(AwsSettingsDto dto, CancellationToken ct)
    {
        var e = await _db.OwnerAwsSettings.FirstOrDefaultAsync(ct);

        if (e is null)
        {
            e = new OwnerAwsSettings { Id = Guid.NewGuid() };
            _db.OwnerAwsSettings.Add(e);
        }

        // Só criptografa se o campo foi preenchido (campo em branco = manter existente)
        if (!string.IsNullOrWhiteSpace(dto.AccessKeyId))
            e.AccessKeyIdEncrypted = _protector.Encrypt(dto.AccessKeyId.Trim());

        if (!string.IsNullOrWhiteSpace(dto.SecretAccessKey))
            e.SecretAccessKeyEncrypted = _protector.Encrypt(dto.SecretAccessKey.Trim());

        if (!string.IsNullOrWhiteSpace(dto.Region))
            e.Region = dto.Region.Trim();

        if (!string.IsNullOrWhiteSpace(dto.BucketName))
            e.BucketName = dto.BucketName.Trim();

        e.PresignedUrlExpirationMinutes = dto.PresignedUrlExpirationMinutes > 0
            ? dto.PresignedUrlExpirationMinutes
            : 15;

        e.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return await GetViewAsync(ct);
    }

    public async Task<AwsOptions?> GetDecryptedAsync(CancellationToken ct)
    {
        var e = await _db.OwnerAwsSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);

        // Banco configurado → usa banco
        if (e is not null
            && !string.IsNullOrWhiteSpace(e.AccessKeyIdEncrypted)
            && !string.IsNullOrWhiteSpace(e.SecretAccessKeyEncrypted)
            && !string.IsNullOrWhiteSpace(e.BucketName))
        {
            return new AwsOptions
            {
                AccessKeyId = _protector.Decrypt(e.AccessKeyIdEncrypted),
                SecretAccessKey = _protector.Decrypt(e.SecretAccessKeyEncrypted),
                Region = e.Region ?? "us-east-1",
                BucketName = e.BucketName,
                PresignedUrlExpirationMinutes = e.PresignedUrlExpirationMinutes,
            };
        }

        // Fallback → appsettings.json (ambiente dev / IAM role)
        if (!string.IsNullOrWhiteSpace(_fallbackOptions.BucketName))
            return _fallbackOptions;

        return null;
    }

    private static string? Mask(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var last4 = value.Length >= 4 ? value[^4..] : value;
        return $"••••••••{last4}";
    }
}
