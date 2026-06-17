using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace LiotecnicaHub.Web.Application.Authentication;

internal static class EntraStateCodec
{
    private const int StateMaxAgeSeconds = 600;

    public static string EncodeAndSign(EntraStatePayload payload, string signingKey)
    {
        var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(payload);
        using var hmac = new HMACSHA256(GetSigningKeyBytes(signingKey));
        var sig = hmac.ComputeHash(payloadBytes);
        return $"{Base64UrlEncode(payloadBytes)}.{Base64UrlEncode(sig)}";
    }

    public static EntraStatePayload? TryDecode(string encodedState, string signingKey)
    {
        if (string.IsNullOrWhiteSpace(encodedState)) return null;

        var dot = encodedState.IndexOf('.');
        if (dot <= 0 || dot == encodedState.Length - 1) return null;

        var payloadPart = encodedState[..dot];
        var sigPart = encodedState[(dot + 1)..];

        byte[] payloadBytes;
        byte[] sigBytes;
        try
        {
            payloadBytes = Base64UrlDecode(payloadPart);
            sigBytes = Base64UrlDecode(sigPart);
        }
        catch (FormatException)
        {
            return null;
        }

        using var hmac = new HMACSHA256(GetSigningKeyBytes(signingKey));
        var expected = hmac.ComputeHash(payloadBytes);
        if (!CryptographicOperations.FixedTimeEquals(expected, sigBytes)) return null;

        EntraStatePayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<EntraStatePayload>(payloadBytes);
        }
        catch (JsonException)
        {
            return null;
        }
        if (payload is null) return null;

        var age = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - payload.IssuedAtUnix;
        if (age is < 0 or > StateMaxAgeSeconds) return null;

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

public sealed record EntraStatePayload(string ReturnUrl, string Nonce, long IssuedAtUnix);
