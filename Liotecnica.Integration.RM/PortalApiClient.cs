using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Cliente HTTP para a API do Portal RH (áreas, departamentos, cargos, vagas).
/// Usa X-Tenant-Id e X-Api-Key (quando a API suportar API Key).
/// </summary>
public sealed class PortalApiClient
{
    private readonly HttpClient _http;
    private readonly PortalApiOptions _options;
    private readonly ILogger<PortalApiClient> _logger;

    public PortalApiClient(HttpClient http, IOptions<PortalApiOptions> options, ILogger<PortalApiClient> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
        var baseUrl = (_options.BaseUrl ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(baseUrl))
            baseUrl = "https://localhost:5001";
        _http.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
        _http.DefaultRequestHeaders.Add("X-Tenant-Id", _options.TenantId);
        if (!string.IsNullOrWhiteSpace(_options.ApiKey))
            _http.DefaultRequestHeaders.Add("X-Api-Key", _options.ApiKey);
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public HttpClient Http => _http;

    /// <summary>
    /// Consulta o status efetivo (habilitado/desabilitado) de um módulo do tenant atual
    /// no <c>ModuleCatalog</c> do Portal. Usado para gating comercial — antes de cada
    /// ciclo o worker verifica se o tenant continua com a integração contratada.
    /// Defensivo (fail-open): em caso de erro de rede ou HTTP 5xx, assume <c>true</c>
    /// para não bloquear o sync por causa de saúde da API. HTTP 404 (módulo inexistente
    /// no catálogo do Portal alvo) é tratado como desabilitado.
    /// </summary>
    public async Task<bool> IsModuleEnabledAsync(string moduleKey, CancellationToken ct)
    {
        try
        {
            var resp = await _http.GetAsync($"api/tenant-modules/{moduleKey}/status", ct);
            if (resp.StatusCode == HttpStatusCode.NotFound)
            {
                _logger.LogWarning("Módulo '{ModuleKey}' não existe no catálogo do Portal — assumindo OFF.", moduleKey);
                return false;
            }
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Falha HTTP {Status} ao consultar status do módulo '{ModuleKey}' — fail-open (assumindo ON).", (int)resp.StatusCode, moduleKey);
                return true;
            }
            var body = await resp.Content.ReadFromJsonAsync<TenantModuleStatusDto>(cancellationToken: ct);
            if (body is null)
            {
                _logger.LogWarning("Resposta vazia ao consultar status do módulo '{ModuleKey}' — fail-open (assumindo ON).", moduleKey);
                return true;
            }
            return body.IsEnabled;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao consultar status do módulo '{ModuleKey}' — fail-open (assumindo ON).", moduleKey);
            return true;
        }
    }

    private sealed record TenantModuleStatusDto(string Key, bool IsEnabled);

    /// <summary>Minutos quando a API está indisponível — alinhado ao padrão do Portal.</summary>
    private const int DefaultRmWorkerCycleMinutes = 5;

    /// <summary>
    /// Lê intervalo entre ciclos configurado no tenant (persistido no Portal). Fallback 5 min se falhar.
    /// </summary>
    public async Task<int> GetWorkerCycleIntervalMinutesAsync(CancellationToken ct)
    {
        try
        {
            var resp = await _http.GetAsync("api/integracao-totvs/rm-worker-cycle", ct);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("GET rm-worker-cycle falhou: {Status} — usando {Fallback} min.", (int)resp.StatusCode, DefaultRmWorkerCycleMinutes);
                return DefaultRmWorkerCycleMinutes;
            }
            var dto = await resp.Content.ReadFromJsonAsync<RmWorkerCycleDto>(cancellationToken: ct);
            if (dto is null || dto.IntervalMinutes < 1)
                return DefaultRmWorkerCycleMinutes;
            return Math.Clamp(dto.IntervalMinutes, 1, 1440);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao ler intervalo rm-worker-cycle — usando {Fallback} min.", DefaultRmWorkerCycleMinutes);
            return DefaultRmWorkerCycleMinutes;
        }
    }

    private sealed record RmWorkerCycleDto(int IntervalMinutes);

    /// <summary>
    /// Cria um <c>RmSyncRun</c> com status InProgress para a entidade informada e devolve o Id.
    /// Defensivo: em caso de falha de rede/HTTP, devolve <c>null</c> para que o sync continue
    /// sem telemetria (não bloquear o trabalho real por causa do log).
    /// </summary>
    public async Task<Guid?> StartRunAsync(string entidade, string operacao, DateTime? watermarkAplicadoUtc, CancellationToken ct)
    {
        try
        {
            var body = new { entidade, operacao, watermarkAplicadoUtc };
            var resp = await _http.PostAsJsonAsync("api/integracao-totvs/rm-runs", body, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var msg = await resp.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("POST rm-runs falhou: {Status} {Msg}", (int)resp.StatusCode, msg);
                return null;
            }
            var dto = await resp.Content.ReadFromJsonAsync<RmSyncRunCreatedDto>(cancellationToken: ct);
            return dto?.Id;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao registrar StartRun para entidade '{Entidade}' — seguindo sem telemetria.", entidade);
            return null;
        }
    }

    /// <summary>
    /// Finaliza um <c>RmSyncRun</c> com counters e status (Sucesso/Falha/FalhaParcial). Fire-and-forget:
    /// erros são logados mas não interrompem o ciclo.
    /// </summary>
    public async Task FinishRunAsync(
        Guid runId,
        short status,
        int totalLidos,
        int criados,
        int atualizados,
        int ignorados,
        string? erroMensagem,
        DateTime? watermarkNovoUtc,
        CancellationToken ct)
    {
        try
        {
            var body = new
            {
                status,
                totalLidos,
                criados,
                atualizados,
                ignorados,
                erroMensagem,
                watermarkNovoUtc,
            };
            var req = new HttpRequestMessage(HttpMethod.Patch, $"api/integracao-totvs/rm-runs/{runId}")
            {
                Content = JsonContent.Create(body),
            };
            var resp = await _http.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var msg = await resp.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("PATCH rm-runs/{RunId} falhou: {Status} {Msg}", runId, (int)resp.StatusCode, msg);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao registrar FinishRun {RunId}.", runId);
        }
    }

    private sealed record RmSyncRunCreatedDto(Guid Id);

    /// <summary>
    /// Lê watermark vigente para uma entidade RM (PFUNC, PPESSOA, VRSVAGAS, etc.).
    /// Retorna null em caso de falha — o worker, sob a dúvida, faz full sync para não perder dados.
    /// </summary>
    public async Task<DateTime?> GetCheckpointAsync(string entidade, CancellationToken ct)
    {
        try
        {
            var resp = await _http.GetAsync($"api/integracao-totvs/rm-checkpoints?entidade={Uri.EscapeDataString(entidade)}", ct);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("GET checkpoint '{Entidade}' falhou: {Status} — assumindo full.", entidade, (int)resp.StatusCode);
                return null;
            }
            var dto = await resp.Content.ReadFromJsonAsync<CheckpointDto>(cancellationToken: ct);
            return dto?.LastRecModifiedOn;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao ler checkpoint '{Entidade}' — assumindo full.", entidade);
            return null;
        }
    }

    /// <summary>
    /// Persiste o novo watermark após sync bem-sucedido. Fire-and-forget: erro logado, ciclo segue.
    /// Se este PUT falhar, o próximo ciclo refaz desde o watermark anterior (UPSERT idempotente cobre duplicação).
    /// </summary>
    public async Task UpdateCheckpointAsync(string entidade, DateTime? lastRecModifiedOn, string lastRunStatus, CancellationToken ct)
    {
        try
        {
            var body = new { entidade, lastRecModifiedOn, lastRunStatus };
            var req = new HttpRequestMessage(HttpMethod.Put, "api/integracao-totvs/rm-checkpoints")
            {
                Content = JsonContent.Create(body),
            };
            var resp = await _http.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var msg = await resp.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("PUT checkpoint '{Entidade}' falhou: {Status} {Msg}", entidade, (int)resp.StatusCode, msg);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao atualizar checkpoint '{Entidade}'.", entidade);
        }
    }

    /// <summary>Reseta TODOS os checkpoints do tenant — usado pelo CLI <c>sync --full</c>.</summary>
    public async Task ResetAllCheckpointsAsync(CancellationToken ct)
    {
        try
        {
            var resp = await _http.PostAsync("api/integracao-totvs/rm-checkpoints/reset-all", content: null, ct);
            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("POST reset-all checkpoints falhou: {Status}", (int)resp.StatusCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao resetar checkpoints.");
        }
    }

    private sealed record CheckpointDto(string Entidade, DateTime? LastRecModifiedOn, DateTimeOffset? LastRunAtUtc, string? LastRunStatus);
}
