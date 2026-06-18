using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace LiotecnicaHub.Web.Application.Authentication;

public sealed record HubSsoTokenPayload(
    string Email,
    string TenantId,
    string ReturnUrl,
    string Nonce,
    long IssuedAtUnix);

internal static class HubSsoTokenCodec
{
    private const int TokenMaxAgeSeconds = 60;

    public static string Encode(HubSsoTokenPayload payload, string signingKey)
    {
        var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(payload);
        using var hmac = new HMACSHA256(GetSigningKeyBytes(signingKey));
        var sig = hmac.ComputeHash(payloadBytes);
        return $"{Base64UrlEncode(payloadBytes)}.{Base64UrlEncode(sig)}";
    }

    public static HubSsoTokenPayload? TryDecode(string encodedToken, string signingKey)
    {
        if (string.IsNullOrWhiteSpace(encodedToken)) return null;

        var dot = encodedToken.IndexOf('.');
        if (dot <= 0 || dot == encodedToken.Length - 1) return null;

        byte[] payloadBytes;
        byte[] sigBytes;
        try
        {
            payloadBytes = Base64UrlDecode(encodedToken[..dot]);
            sigBytes = Base64UrlDecode(encodedToken[(dot + 1)..]);
        }
        catch (FormatException)
        {
            return null;
        }

        using var hmac = new HMACSHA256(GetSigningKeyBytes(signingKey));
        var expected = hmac.ComputeHash(payloadBytes);
        if (!CryptographicOperations.FixedTimeEquals(expected, sigBytes)) return null;

        HubSsoTokenPayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<HubSsoTokenPayload>(payloadBytes);
        }
        catch (JsonException)
        {
            return null;
        }

        if (payload is null
            || string.IsNullOrWhiteSpace(payload.Email)
            || string.IsNullOrWhiteSpace(payload.TenantId))
            return null;

        var age = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - payload.IssuedAtUnix;
        if (age is < 0 or > TokenMaxAgeSeconds) return null;

        return payload;
    }

    private static byte[] GetSigningKeyBytes(string signingKey) => Encoding.UTF8.GetBytes(signingKey);

    private static string Base64UrlEncode(byte[] input) =>
        Convert.ToBase64String(input).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string input)
    {
        var s = input.Replace('-', '+').Replace('_', '/');
        switch (s.Length % 4)
        {
            case 2: s += "=="; break;
            case 3: s += "="; break;
        }
        return Convert.FromBase64String(s);
    }
}
