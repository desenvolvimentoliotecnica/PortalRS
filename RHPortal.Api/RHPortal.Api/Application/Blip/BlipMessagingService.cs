using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Blip;

public sealed class BlipMessagingService
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<BlipMessagingService> _logger;

    public BlipMessagingService(AppDbContext db, IHttpClientFactory httpClientFactory, ILogger<BlipMessagingService> logger)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    /// <summary>
    /// Envia o template de onboarding de admissão via WhatsApp para o candidato.
    /// Retorna true se enviado com sucesso, false se config ausente ou falha (best-effort).
    /// </summary>
    public async Task<bool> EnviarOnboardingAdmissaoAsync(string celular, CancellationToken ct)
    {
        var config = await _db.TenantConfiguracoes.AsNoTracking().FirstOrDefaultAsync(ct);

        if (config is null
            || string.IsNullOrWhiteSpace(config.BlipApiUrl)
            || string.IsNullOrWhiteSpace(config.BlipApiKey))
            return false;

        var phoneNorm = NormalizePhone(celular);
        if (string.IsNullOrWhiteSpace(phoneNorm))
            return false;

        var payload = new
        {
            id = Guid.NewGuid().ToString(),
            to = $"+{phoneNorm}@wa.gw.msging.net",
            type = "application/json",
            content = new
            {
                type = "template",
                template = new
                {
                    @namespace = "63f5fe62_5dc8_4018_9237_c78dc73ccc16",
                    name = "admissao_rh_onboarding",
                    language = new { code = "pt_BR" },
                    components = Array.Empty<object>()
                }
            }
        };

        try
        {
            using var http = _httpClientFactory.CreateClient();
            var json = JsonSerializer.Serialize(payload);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            http.DefaultRequestHeaders.Add("Authorization", $"Key {config.BlipApiKey}");

            var response = await http.PostAsync(config.BlipApiUrl, content, ct);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Blip retornou {Status} ao enviar onboarding: {Body}", response.StatusCode, body);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao enviar mensagem Blip de onboarding para {Phone}", phoneNorm);
            return false;
        }
    }

    private static string NormalizePhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        // Garante código do país Brasil se não tiver
        if (digits.Length == 11 || digits.Length == 10)
            digits = "55" + digits;
        return digits;
    }
}
