namespace RhPortal.Api.Infrastructure.Storage;

public interface IS3StorageService
{
    /// <summary>Faz upload de um stream para o S3 e retorna a key armazenada.</summary>
    Task<string> UploadAsync(Stream stream, string key, string contentType, CancellationToken ct = default);

    /// <summary>Remove um objeto do S3 pela key.</summary>
    Task DeleteAsync(string key, CancellationToken ct = default);

    /// <summary>Gera uma presigned URL temporária para download direto.</summary>
    string GetPresignedUrl(string key, TimeSpan? expiresIn = null);
}
