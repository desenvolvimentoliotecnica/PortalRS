using System.Security.Cryptography;
using System.Text.Json;
using LiotecnicaHub.Web.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace LiotecnicaHub.Web.Application.Authentication;

public sealed record EntraAuthorizationUrl(string Url, string EncodedState);

public sealed record EntraTokenExchangeResult(string? IdToken, string? ErrorCode);

public interface IEntraChallengeService
{
    Task<EntraAuthorizationUrl?> BuildAuthorizationUrlAsync(string redirectUri, string returnUrl, CancellationToken ct);
    Task<EntraTokenExchangeResult> ExchangeCodeForIdTokenAsync(string code, string redirectUri, CancellationToken ct);
    EntraStatePayload? TryDecodeState(string encodedState);
}

public sealed class EntraChallengeService : IEntraChallengeService
{
    private readonly IHubEntraConfigService _configService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly HubOptions _hubOptions;
    private readonly ILogger<EntraChallengeService> _logger;

    public EntraChallengeService(
        IHubEntraConfigService configService,
        IHttpClientFactory httpClientFactory,
        IOptions<HubOptions> hubOptions,
        ILogger<EntraChallengeService> logger)
    {
        _configService = configService;
        _httpClientFactory = httpClientFactory;
        _hubOptions = hubOptions.Value;
        _logger = logger;
    }

    public async Task<EntraAuthorizationUrl?> BuildAuthorizationUrlAsync(
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
            ReturnUrl: string.IsNullOrWhiteSpace(returnUrl) ? "/Apps" : returnUrl,
            Nonce: Convert.ToHexString(RandomNumberGenerator.GetBytes(8)),
            IssuedAtUnix: DateTimeOffset.UtcNow.ToUnixTimeSeconds());

        var encodedState = EntraStateCodec.EncodeAndSign(state, _hubOptions.StateSigningKey);

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

    public async Task<EntraTokenExchangeResult> ExchangeCodeForIdTokenAsync(string code, string redirectUri, CancellationToken ct)
    {
        var config = await _configService.GetDecryptedAsync(ct);
        if (config is null || !config.IsEnabled)
        {
            _logger.LogWarning("Entra token exchange: config ausente ou desabilitada.");
            return new(null, "nao_configurado");
        }

        var entraTenant = config.EntraTenantId?.Trim();
        var clientId = config.ClientId?.Trim();
        var clientSecret = config.ClientSecret?.Trim();
        if (string.IsNullOrWhiteSpace(entraTenant) || string.IsNullOrWhiteSpace(clientId))
        {
            _logger.LogWarning("Entra token exchange: tenant ou client id ausente.");
            return new(null, "nao_configurado");
        }

        if (string.IsNullOrWhiteSpace(clientSecret))
        {
            _logger.LogWarning("Entra token exchange: client secret ausente no banco.");
            return new(null, "secret_ausente");
        }

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
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Entra token exchange: falha de rede.");
            return new(null, "troca_de_code_falhou");
        }

        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogWarning("Entra token exchange falhou: status={Status} body={Body}", (int)resp.StatusCode, body);
            return new(null, MapAzureTokenError(body));
        }

        try
        {
            using var doc = JsonDocument.Parse(body);
            var idToken = doc.RootElement.TryGetProperty("id_token", out var idTokenEl)
                            && idTokenEl.ValueKind == JsonValueKind.String
                ? idTokenEl.GetString()
                : null;
            return string.IsNullOrWhiteSpace(idToken)
                ? new(null, "troca_de_code_falhou")
                : new(idToken, null);
        }
        catch (JsonException)
        {
            return new(null, "troca_de_code_falhou");
        }
    }

    private static string MapAzureTokenError(string body)
    {
        if (body.Contains("invalid_client", StringComparison.OrdinalIgnoreCase))
            return "secret_invalido";
        if (body.Contains("redirect_uri", StringComparison.OrdinalIgnoreCase))
            return "redirect_uri_invalido";
        return "troca_de_code_falhou";
    }

    public EntraStatePayload? TryDecodeState(string encodedState) =>
        EntraStateCodec.TryDecode(encodedState, _hubOptions.StateSigningKey);
}
