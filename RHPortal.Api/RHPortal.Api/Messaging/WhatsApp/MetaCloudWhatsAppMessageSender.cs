using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace RhPortal.Api.Messaging.WhatsApp;

/// <summary>
/// Provedor real WhatsApp Cloud API (Meta) via Graph REST.
/// Endpoint: POST {BaseUrl}/{GraphVersion}/{PhoneNumberId}/messages
/// Auth: Bearer {AccessToken}. Payload JSON: messaging_product/to/type/text.
/// Resposta inclui messages[0].id — gravamos como ProviderMessageId.
/// </summary>
public sealed class MetaCloudWhatsAppMessageSender : IWhatsAppMessageSender
{
    public const string HttpClientName = "WhatsApp.MetaCloud";

    private readonly HttpClient _http;
    private readonly IOptionsMonitor<WhatsAppOptions> _options;
    private readonly ILogger<MetaCloudWhatsAppMessageSender> _logger;

    public MetaCloudWhatsAppMessageSender(
        HttpClient http,
        IOptionsMonitor<WhatsAppOptions> options,
        ILogger<MetaCloudWhatsAppMessageSender> logger)
    {
        _http = http;
        _options = options;
        _logger = logger;
    }

    public async Task<WhatsAppSendResult> SendAsync(string telefoneE164, string mensagem, CancellationToken ct)
    {
        var cfg = _options.CurrentValue.MetaCloud;

        if (string.IsNullOrWhiteSpace(cfg.PhoneNumberId) || string.IsNullOrWhiteSpace(cfg.AccessToken))
        {
            _logger.LogError("[MetaCloud] credenciais ausentes — verifique WhatsApp:MetaCloud:{{PhoneNumberId,AccessToken}}.");
            return new WhatsAppSendResult(false, ErrorMessage: "metacloud_credenciais_ausentes");
        }

        if (string.IsNullOrWhiteSpace(telefoneE164))
            return new WhatsAppSendResult(false, ErrorMessage: "telefone_vazio");

        // Meta Graph espera o número SEM o prefixo "+" (ex.: 5511987654321).
        var to = telefoneE164.TrimStart('+');

        var graphVersion = string.IsNullOrWhiteSpace(cfg.GraphVersion) ? "v18.0" : cfg.GraphVersion;
        var baseUrl = (cfg.BaseUrl ?? "https://graph.facebook.com").TrimEnd('/');
        var url = $"{baseUrl}/{graphVersion}/{cfg.PhoneNumberId}/messages";

        var payload = new
        {
            messaging_product = "whatsapp",
            to,
            type = "text",
            text = new { body = mensagem ?? string.Empty },
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", cfg.AccessToken);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        try
        {
            using var response = await _http.SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "[MetaCloud] envio recusado status={Status} destino={Telefone} body={Body}",
                    (int)response.StatusCode, to, Truncate(body, 500));
                var msg = TryExtractMetaError(body) ?? $"metacloud_status_{(int)response.StatusCode}";
                return new WhatsAppSendResult(false, ErrorMessage: msg);
            }

            var id = TryExtractMessageId(body);
            _logger.LogInformation("[MetaCloud] envio aceito destino={Telefone} id={Id}", to, id);
            return new WhatsAppSendResult(true, ProviderMessageId: id);
        }
        catch (TaskCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[MetaCloud] falha transiente destino={Telefone}", to);
            return new WhatsAppSendResult(false, ErrorMessage: $"metacloud_exception:{ex.GetType().Name}");
        }
    }

    private static string? TryExtractMessageId(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("messages", out var messages)
                && messages.ValueKind == JsonValueKind.Array
                && messages.GetArrayLength() > 0
                && messages[0].TryGetProperty("id", out var idEl)
                && idEl.ValueKind == JsonValueKind.String)
            {
                return idEl.GetString();
            }
        }
        catch (JsonException) { /* ignore */ }
        return null;
    }

    private static string? TryExtractMetaError(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("error", out var err))
            {
                string? msg = null;
                string? code = null;
                if (err.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String) msg = m.GetString();
                if (err.TryGetProperty("code", out var c)) code = c.ToString();
                return (code, msg) switch
                {
                    (null, null) => null,
                    (null, _) => msg,
                    (_, null) => $"metacloud_code_{code}",
                    _ => $"metacloud_code_{code}:{msg}"
                };
            }
        }
        catch (JsonException) { /* ignore */ }
        return null;
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max] + "…";
}
