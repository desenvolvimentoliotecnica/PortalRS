using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace RhPortal.Api.Messaging.WhatsApp;

/// <summary>
/// Provedor real Twilio WhatsApp via REST API (sem dependência do SDK).
/// Endpoint: POST {BaseUrl}/2010-04-01/Accounts/{AccountSid}/Messages.json
/// Auth: Basic (AccountSid:AuthToken). Payload form-urlencoded com From/To/Body.
/// Resposta JSON inclui "sid" — gravamos como ProviderMessageId.
/// </summary>
public sealed class TwilioWhatsAppMessageSender : IWhatsAppMessageSender
{
    public const string HttpClientName = "WhatsApp.Twilio";

    private readonly HttpClient _http;
    private readonly IOptionsMonitor<WhatsAppOptions> _options;
    private readonly ILogger<TwilioWhatsAppMessageSender> _logger;

    public TwilioWhatsAppMessageSender(
        HttpClient http,
        IOptionsMonitor<WhatsAppOptions> options,
        ILogger<TwilioWhatsAppMessageSender> logger)
    {
        _http = http;
        _options = options;
        _logger = logger;
    }

    public async Task<WhatsAppSendResult> SendAsync(string telefoneE164, string mensagem, CancellationToken ct)
    {
        var cfg = _options.CurrentValue.Twilio;

        if (string.IsNullOrWhiteSpace(cfg.AccountSid) || string.IsNullOrWhiteSpace(cfg.AuthToken) || string.IsNullOrWhiteSpace(cfg.FromNumber))
        {
            _logger.LogError("[Twilio] credenciais ausentes — verifique WhatsApp:Twilio:{{AccountSid,AuthToken,FromNumber}}.");
            return new WhatsAppSendResult(false, ErrorMessage: "twilio_credenciais_ausentes");
        }

        if (string.IsNullOrWhiteSpace(telefoneE164))
            return new WhatsAppSendResult(false, ErrorMessage: "telefone_vazio");

        var to = telefoneE164.StartsWith("whatsapp:", StringComparison.OrdinalIgnoreCase)
            ? telefoneE164
            : $"whatsapp:{telefoneE164}";

        var from = cfg.FromNumber.StartsWith("whatsapp:", StringComparison.OrdinalIgnoreCase)
            ? cfg.FromNumber
            : $"whatsapp:{cfg.FromNumber}";

        var baseUrl = (cfg.BaseUrl ?? "https://api.twilio.com").TrimEnd('/');
        var url = $"{baseUrl}/2010-04-01/Accounts/{cfg.AccountSid}/Messages.json";

        var payload = new List<KeyValuePair<string, string>>
        {
            new("From", from),
            new("To", to),
            new("Body", mensagem ?? string.Empty),
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new FormUrlEncodedContent(payload),
        };

        var basic = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{cfg.AccountSid}:{cfg.AuthToken}"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", basic);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        try
        {
            using var response = await _http.SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "[Twilio] envio recusado status={Status} destino={Telefone} body={Body}",
                    (int)response.StatusCode, to, Truncate(body, 500));
                var msg = TryExtractTwilioError(body) ?? $"twilio_status_{(int)response.StatusCode}";
                return new WhatsAppSendResult(false, ErrorMessage: msg);
            }

            var sid = TryExtractSid(body);
            _logger.LogInformation("[Twilio] envio aceito destino={Telefone} sid={Sid}", to, sid);
            return new WhatsAppSendResult(true, ProviderMessageId: sid);
        }
        catch (TaskCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Twilio] falha transiente destino={Telefone}", to);
            return new WhatsAppSendResult(false, ErrorMessage: $"twilio_exception:{ex.GetType().Name}");
        }
    }

    private static string? TryExtractSid(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("sid", out var sid) && sid.ValueKind == JsonValueKind.String)
                return sid.GetString();
        }
        catch (JsonException) { /* ignore — provedor pode devolver texto */ }
        return null;
    }

    private static string? TryExtractTwilioError(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            string? msg = null;
            string? code = null;
            if (root.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String) msg = m.GetString();
            if (root.TryGetProperty("code", out var c)) code = c.ToString();
            return (code, msg) switch
            {
                (null, null) => null,
                (null, _) => msg,
                (_, null) => $"twilio_code_{code}",
                _ => $"twilio_code_{code}:{msg}"
            };
        }
        catch (JsonException) { return null; }
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max] + "…";
}
