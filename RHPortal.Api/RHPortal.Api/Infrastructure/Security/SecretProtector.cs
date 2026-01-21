using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace RhPortal.Api.Infrastructure.Security;

public interface ISecretProtector
{
    string Encrypt(string plainText);
    string Decrypt(string cipherText);
}

public sealed class AesSecretProtector : ISecretProtector
{
    private readonly byte[] _key;

    public AesSecretProtector(IConfiguration config)
    {
        var rawKey = config["EmailConfig:EncryptionKey"] ?? config["EMAIL_CONFIG_ENCRYPTION_KEY"];
        if (string.IsNullOrWhiteSpace(rawKey))
            throw new InvalidOperationException("EmailConfig:EncryptionKey is required for email configuration encryption.");

        _key = NormalizeKey(rawKey);
    }

    public string Encrypt(string plainText)
    {
        if (string.IsNullOrEmpty(plainText)) return string.Empty;
        using var aes = Aes.Create();
        aes.Key = _key;
        aes.GenerateIV();

        using var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);
        using var ms = new MemoryStream();
        using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
        using (var sw = new StreamWriter(cs, Encoding.UTF8))
        {
            sw.Write(plainText);
        }

        var iv = Convert.ToBase64String(aes.IV);
        var cipher = Convert.ToBase64String(ms.ToArray());
        return $"{iv}:{cipher}";
    }

    public string Decrypt(string cipherText)
    {
        if (string.IsNullOrEmpty(cipherText)) return string.Empty;
        var parts = cipherText.Split(':', 2);
        if (parts.Length != 2) return string.Empty;

        var iv = Convert.FromBase64String(parts[0]);
        var buffer = Convert.FromBase64String(parts[1]);

        using var aes = Aes.Create();
        aes.Key = _key;
        aes.IV = iv;
        using var decryptor = aes.CreateDecryptor(aes.Key, aes.IV);
        using var ms = new MemoryStream(buffer);
        using var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read);
        using var sr = new StreamReader(cs, Encoding.UTF8);
        return sr.ReadToEnd();
    }

    private static byte[] NormalizeKey(string raw)
    {
        try
        {
            var bytes = Convert.FromBase64String(raw);
            if (bytes.Length >= 32) return bytes.Take(32).ToArray();
        }
        catch
        {
            // not base64, fallback to hash
        }

        using var sha = SHA256.Create();
        return sha.ComputeHash(Encoding.UTF8.GetBytes(raw));
    }
}
