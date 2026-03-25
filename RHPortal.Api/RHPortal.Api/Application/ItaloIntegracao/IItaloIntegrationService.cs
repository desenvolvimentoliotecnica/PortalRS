using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace RhPortal.Api.Application.ItaloIntegracao;

/// <summary>
/// Serviço de integração com a API do Ítalo — responsável por notificar o candidato
/// via WhatsApp para que envie seus documentos (RG, CPF, comprovante de residência).
/// </summary>
public interface IItaloIntegrationService
{
    /// <summary>
    /// Notifica a API do Ítalo para iniciar a coleta de documentos do candidato via WhatsApp.
    /// Chamado quando o gestor aprova a contratação.
    /// </summary>
    Task NotificarCandidatoAsync(Guid preAdmissaoId, string nome, string? celular, string? email, CancellationToken ct);
}

public sealed class ItaloIntegrationService : IItaloIntegrationService
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<ItaloIntegrationService> _logger;

    public ItaloIntegrationService(HttpClient http, IConfiguration config, ILogger<ItaloIntegrationService> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    public async Task NotificarCandidatoAsync(Guid preAdmissaoId, string nome, string? celular, string? email, CancellationToken ct)
    {
        var baseUrl = _config["Italo:BaseUrl"]?.Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            _logger.LogWarning(
                "Italo:BaseUrl não configurado — notificação de coleta de documentos ignorada para preAdmissaoId={Id}", preAdmissaoId);
            return;
        }

        var payload = new
        {
            preAdmissaoId,
            nome,
            celular,
            email,
        };

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/iniciar-coleta");
            request.Content = JsonContent.Create(payload);

            var apiKey = _config["Italo:ApiKey"];
            if (!string.IsNullOrWhiteSpace(apiKey))
                request.Headers.Add("X-Api-Key", apiKey);

            var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Ítalo retornou HTTP {Status} ao notificar preAdmissaoId={Id}", (int)response.StatusCode, preAdmissaoId);
            }
        }
        catch (Exception ex)
        {
            // Não bloquear o fluxo principal se o Ítalo estiver indisponível
            _logger.LogWarning(ex, "Falha ao notificar Ítalo para preAdmissaoId={Id}", preAdmissaoId);
        }
    }
}
