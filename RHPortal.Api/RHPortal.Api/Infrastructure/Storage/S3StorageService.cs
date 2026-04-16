using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;
using RhPortal.Api.Application.AwsSettings;

namespace RhPortal.Api.Infrastructure.Storage;

public sealed class AwsOptions
{
    public string AccessKeyId { get; set; } = string.Empty;
    public string SecretAccessKey { get; set; } = string.Empty;
    public string Region { get; set; } = "us-east-1";
    public string BucketName { get; set; } = string.Empty;
    /// <summary>Tempo de expiração padrão das presigned URLs em minutos. Default: 15.</summary>
    public int PresignedUrlExpirationMinutes { get; set; } = 15;
}

public sealed class S3StorageService : IS3StorageService
{
    private readonly IAwsSettingsService _awsSettings;

    public S3StorageService(IAwsSettingsService awsSettings)
    {
        _awsSettings = awsSettings;
    }

    public async Task<string> UploadAsync(Stream stream, string key, string contentType, CancellationToken ct = default)
    {
        var (client, opts) = await BuildClientAsync(ct);
        var request = new PutObjectRequest
        {
            BucketName = opts.BucketName,
            Key = key,
            InputStream = stream,
            ContentType = contentType,
            ServerSideEncryptionMethod = ServerSideEncryptionMethod.AES256,
        };
        await client.PutObjectAsync(request, ct);
        return key;
    }

    public async Task DeleteAsync(string key, CancellationToken ct = default)
    {
        var (client, opts) = await BuildClientAsync(ct);
        await client.DeleteObjectAsync(opts.BucketName, key, ct);
    }

    public string GetPresignedUrl(string key, TimeSpan? expiresIn = null)
    {
        // GetPresignedUrl é síncrono na SDK — resolve as credenciais de forma síncrona
        var opts = _awsSettings.GetDecryptedAsync(default).GetAwaiter().GetResult();
        // S3 não configurado: retorna vazio em vez de lançar exception
        // (documentos sem URL são listados normalmente; upload/download falhará separadamente)
        if (opts is null) return string.Empty;

        var client = BuildClient(opts);
        // AWS SigV4 limita presigned URLs a no máximo 604800 segundos (7 dias)
        var maxExpiry = TimeSpan.FromSeconds(604800);
        var expiration = expiresIn ?? TimeSpan.FromMinutes(opts.PresignedUrlExpirationMinutes);
        if (expiration > maxExpiry) expiration = maxExpiry;

        var request = new GetPreSignedUrlRequest
        {
            BucketName = opts.BucketName,
            Key = key,
            Expires = DateTime.UtcNow.Add(expiration),
            Verb = HttpVerb.GET,
        };
        return client.GetPreSignedURL(request);
    }

    // ── helpers ──

    private async Task<(IAmazonS3 client, AwsOptions opts)> BuildClientAsync(CancellationToken ct)
    {
        var opts = await _awsSettings.GetDecryptedAsync(ct)
            ?? throw new InvalidOperationException("AWS S3 não configurado. Acesse Configurações → AWS S3 para configurar.");
        return (BuildClient(opts), opts);
    }

    private static IAmazonS3 BuildClient(AwsOptions opts)
    {
        var credentials = new BasicAWSCredentials(opts.AccessKeyId, opts.SecretAccessKey);
        var region = RegionEndpoint.GetBySystemName(opts.Region);
        return new AmazonS3Client(credentials, region);
    }
}
