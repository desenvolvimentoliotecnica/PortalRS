using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Application.Authentication;

/// <summary>
/// Coordena o fluxo OAuth 2.0 Authorization Code do Entra ID (Microsoft) fim-a-fim,
/// substituindo o middleware OIDC do antigo LioTecnica.Web.
/// </summary>
/// <remarks>
/// Responsabilidades:
///  1) Construir a URL de autorização do Microsoft a partir da configuração por-tenant
///     (<see cref="EntraIdConfigService"/>).
///  2) Trocar o <c>code</c> recebido no callback por um <c>id_token</c> no endpoint de token.
///  3) Assinar/verificar o <c>state</c> usado para proteção CSRF e para carregar o
///     <c>tenantId</c> + <c>returnUrl</c> entre challenge e callback
///     (HMAC-SHA256 com a mesma signing key do JWT).
///
/// A validação da assinatura do <c>id_token</c> permanece no <see cref="EntraTokenValidator"/>
/// — este service apenas orquestra HTTP e state.
/// </remarks>
public interface IEntraChallengeService
{
    /// <summary>
    /// Monta a URL do endpoint de autorização Microsoft + o state assinado.
    /// Retorna <c>null</c> se a configuração Entra ID do tenant estiver ausente/inválida.
    /// </summary>
    Task<EntraAuthorizationUrl?> BuildAuthorizationUrlAsync(
        string tenantId,
        string redirectUri,
        string returnUrl,
        CancellationToken ct);

    /// <summary>
    /// Troca o <c>code</c> recebido no callback por <c>id_token</c> (chamada back-channel
    /// ao <c>token_endpoint</c> do Microsoft usando client_secret descriptografado).
    /// </summary>
    Task<string?> ExchangeCodeForIdTokenAsync(
        string tenantId,
        string code,
        string redirectUri,
        CancellationToken ct);

    /// <summary>
    /// Decodifica e verifica o HMAC do state recebido no callback.
    /// Retorna <c>null</c> quando a assinatura é inválida ou o state expirou (10 min).
    /// </summary>
    EntraStatePayload? TryDecodeState(string encodedState);
}

public sealed record EntraAuthorizationUrl(string Url, string EncodedState);

public sealed record EntraStatePayload(string TenantId, string ReturnUrl, string Nonce, long IssuedAtUnix);

public sealed class EntraChallengeService : IEntraChallengeService
{
    // 10 minutos de janela para o usuário concluir o login no Microsoft.
    private const int StateMaxAgeSeconds = 600;

    private readonly IEntraIdConfigService _configService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly JwtOptions _jwtOptions;
    private readonly ISecretProtector _protector;

    public EntraChallengeService(
        IEntraIdConfigService configService,
        IHttpClientFactory httpClientFactory,
        IOptions<JwtOptions> jwtOptions,
        ISecretProtector protector)
    {
        _configService = configService;
        _httpClientFactory = httpClientFactory;
        _jwtOptions = jwtOptions.Value;
        _protector = protector;
    }

    public async Task<EntraAuthorizationUrl?> BuildAuthorizationUrlAsync(
        string tenantId,
        string redirectUri,
        string returnUrl,
        CancellationToken ct)
    {
        var config = await _configService.GetDecryptedAsync(ct);
        if (config is null || !config.IsEnabled) return null;

        var entraTenant = config.EntraTenantId?.Trim();
        var clientId = config.ClientId?.Trim();
        if (string.IsNullOrWhiteSpace(entraTenant) || string.IsNullOrWhiteSpace(clientId))
            return null;

        var state = new EntraStatePayload(
            TenantId: tenantId,
            ReturnUrl: string.IsNullOrWhiteSpace(returnUrl) ? "/app/dashboard" : returnUrl,
            Nonce: Convert.ToHexString(RandomNumberGenerator.GetBytes(8)),
            IssuedAtUnix: DateTimeOffset.UtcNow.ToUnixTimeSeconds());

        var encodedState = EncodeAndSignState(state);

        // Autoridade do Microsoft Entra baseada no tenant configurado.
        var authority = $"https://login.microsoftonline.com/{entraTenant}/oauth2/v2.0/authorize";
        var qs = new List<KeyValuePair<string, string>>
        {
            new("client_id", clientId),
            new("response_type", "code"),
            new("redirect_uri", redirectUri),
            new("response_mode", "query"),
            new("scope", "openid profile email"),
            new("state", encodedState),
        };

        var url = authority + "?" + string.Join("&",
            qs.Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));

        return new EntraAuthorizationUrl(url, encodedState);
    }

    public async Task<string?> ExchangeCodeForIdTokenAsync(
        string tenantId,
        string code,
        string redirectUri,
        CancellationToken ct)
    {
        _ = tenantId; // tenantId é usado pelo ITenantContext externamente; mantido para tracing.

        var config = await _configService.GetDecryptedAsync(ct);
        if (config is null || !config.IsEnabled) return null;

        var entraTenant = config.EntraTenantId?.Trim();
        var clientId = config.ClientId?.Trim();
        var clientSecret = config.ClientSecret?.Trim();
        if (string.IsNullOrWhiteSpace(entraTenant)
            || string.IsNullOrWhiteSpace(clientId)
            || string.IsNullOrWhiteSpace(clientSecret))
            return null;

        var tokenEndpoint = $"https://login.microsoftonline.com/{entraTenant}/oauth2/v2.0/token";
        var http = _httpClientFactory.CreateClient();
        var form = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("client_id", clientId),
            new KeyValuePair<string, string>("client_secret", clientSecret),
            new KeyValuePair<string, string>("code", code),
            new KeyValuePair<string, string>("redirect_uri", redirectUri),
            new KeyValuePair<string, string>("grant_type", "authorization_code"),
            new KeyValuePair<string, string>("scope", "openid profile email"),
        });

        HttpResponseMessage resp;
        try
        {
            resp = await http.PostAsync(tokenEndpoint, form, ct);
        }
        catch (HttpRequestException)
        {
            return null;
        }

        if (!resp.IsSuccessStatusCode) return null;

        var body = await resp.Content.ReadAsStringAsync(ct);
        try
        {
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.TryGetProperty("id_token", out var idToken)
                   && idToken.ValueKind == JsonValueKind.String
                ? idToken.GetString()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public EntraStatePayload? TryDecodeState(string encodedState)
    {
        if (string.IsNullOrWhiteSpace(encodedState)) return null;

        // encodedState = base64url(json).base64url(hmac)
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

        using var hmac = new HMACSHA256(GetSigningKeyBytes());
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

    // ── helpers privados ────────────────────────────────────────────────────

    public string EncodeAndSignState(EntraStatePayload payload)
    {
        var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(payload);
        using var hmac = new HMACSHA256(GetSigningKeyBytes());
        var sig = hmac.ComputeHash(payloadBytes);
        return $"{Base64UrlEncode(payloadBytes)}.{Base64UrlEncode(sig)}";
    }

    private byte[] GetSigningKeyBytes() => Encoding.UTF8.GetBytes(_jwtOptions.SigningKey);

    private static string Base64UrlEncode(byte[] input)
    {
        return Convert.ToBase64String(input)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

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
