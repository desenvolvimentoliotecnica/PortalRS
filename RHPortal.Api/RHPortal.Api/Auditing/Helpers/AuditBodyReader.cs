using System.Security.Cryptography;
using System.Text;

namespace RhPortal.Api.Auditing.Helpers;

public sealed class AuditBodyCapture
{
    public string? Text { get; init; }
    public string? Hash { get; init; }
    public bool IsTruncated { get; init; }
    public int TruncatedBytes { get; init; }
}

public static class AuditBodyReader
{
    public static async Task<AuditBodyCapture> ReadAsync(Stream body, int maxBytes, CancellationToken ct)
    {
        if (body == Stream.Null)
            return new AuditBodyCapture();

        body.Seek(0, SeekOrigin.Begin);

        var buffer = new byte[8192];
        var captured = new MemoryStream();
        long totalBytes = 0;

        using var sha = SHA256.Create();

        int read;
        while ((read = await body.ReadAsync(buffer.AsMemory(0, buffer.Length), ct)) > 0)
        {
            sha.TransformBlock(buffer, 0, read, null, 0);
            totalBytes += read;

            if (captured.Length < maxBytes)
            {
                var remaining = maxBytes - (int)captured.Length;
                var toWrite = Math.Min(remaining, read);
                captured.Write(buffer, 0, toWrite);
            }
        }

        sha.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
        body.Seek(0, SeekOrigin.Begin);

        var capturedBytes = captured.ToArray();
        var isTruncated = totalBytes > maxBytes;
        var truncatedBytes = isTruncated ? (int)(totalBytes - maxBytes) : 0;
        var text = capturedBytes.Length == 0 ? null : Encoding.UTF8.GetString(capturedBytes);
        var hash = totalBytes > 0 ? Convert.ToHexString(sha.Hash ?? Array.Empty<byte>()) : null;

        return new AuditBodyCapture
        {
            Text = text,
            Hash = hash,
            IsTruncated = isTruncated,
            TruncatedBytes = truncatedBytes
        };
    }
}
