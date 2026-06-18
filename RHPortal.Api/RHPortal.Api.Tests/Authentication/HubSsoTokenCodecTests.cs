using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using RhPortal.Api.Application.Authentication;
using Xunit;

namespace RhPortal.Api.Tests.Authentication;

public sealed class HubSsoTokenCodecTests
{
    private const string SigningKey = "ChangeThisHubSsoSigningKey1234567890";

    [Fact]
    public void TryDecode_token_valido_retorna_payload()
    {
        var payload = new HubSsoTokenPayload(
            Email: "user@liotecnica.com.br",
            TenantId: "liotecnica",
            ReturnUrl: "/dashboard",
            Nonce: "abc123",
            IssuedAtUnix: DateTimeOffset.UtcNow.ToUnixTimeSeconds());

        var token = Encode(payload, SigningKey);
        var decoded = HubSsoTokenCodec.TryDecode(token, SigningKey);

        Assert.NotNull(decoded);
        Assert.Equal(payload.Email, decoded!.Email);
        Assert.Equal(payload.TenantId, decoded.TenantId);
    }

    [Fact]
    public void TryDecode_token_tampered_retorna_null()
    {
        var token = Encode(
            new HubSsoTokenPayload("a@b.com", "liotecnica", "/dashboard", "n", DateTimeOffset.UtcNow.ToUnixTimeSeconds()),
            SigningKey);
        var tampered = token[..^1] + (token[^1] == 'a' ? 'b' : 'a');

        Assert.Null(HubSsoTokenCodec.TryDecode(tampered, SigningKey));
    }

    [Fact]
    public void TryDecode_token_expirado_retorna_null()
    {
        var payload = new HubSsoTokenPayload(
            Email: "user@liotecnica.com.br",
            TenantId: "liotecnica",
            ReturnUrl: "/dashboard",
            Nonce: "abc123",
            IssuedAtUnix: DateTimeOffset.UtcNow.AddMinutes(-2).ToUnixTimeSeconds());

        var token = Encode(payload, SigningKey);
        Assert.Null(HubSsoTokenCodec.TryDecode(token, SigningKey));
    }

    private static string Encode(HubSsoTokenPayload payload, string signingKey)
    {
        var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(payload);
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(signingKey));
        var sig = hmac.ComputeHash(payloadBytes);
        return $"{Base64UrlEncode(payloadBytes)}.{Base64UrlEncode(sig)}";
    }

    private static string Base64UrlEncode(byte[] input) =>
        Convert.ToBase64String(input).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
