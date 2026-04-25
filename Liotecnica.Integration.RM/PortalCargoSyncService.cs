using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Envia Cargos do RM (PCARGO / cargo.json) para o portal (api/job-positions).
/// Usa o primeiro Centro de Custo do portal como CentroCustoId padrão.
/// </summary>
public sealed class PortalCargoSyncService
{
    private readonly ILogger<PortalCargoSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public PortalCargoSyncService(
        ILogger<PortalCargoSyncService> logger,
        PortalApiClient portalClient,
        IOptions<OutputOptions> outputOptions,
        IHostEnvironment env,
        ExtractionLogWriter logWriter)
    {
        _logger = logger;
        _portalClient = portalClient;
        _outputOptions = outputOptions.Value;
        _env = env;
        _logWriter = logWriter;
    }

    /// <summary>
    /// Lê cargo.json (PCARGO) e envia para api/job-positions (Cargos no portal).
    /// </summary>
    public async Task SyncCargosFromCargoJsonAsync(CancellationToken ct = default)
    {
        try
        {
            await SyncCargosFromCargoJsonCoreAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Cargos: falha geral.");
            _logWriter.WriteLine($"Sync Cargos: falha geral - {ex.Message}");
        }
    }

    private async Task SyncCargosFromCargoJsonCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var file = Path.Combine(path, "cargo.json");
        if (!File.Exists(file))
        {
            _logWriter.WriteLine("Sync Cargos: arquivo cargo.json não encontrado; pulando envio.");
            _logger.LogWarning("Arquivo {File} não encontrado; pulando sync de cargos.", file);
            return;
        }

        var defaultCentroCustoId = await GetFirstCentroCustoIdAsync(ct);
        if (defaultCentroCustoId == Guid.Empty)
        {
            _logWriter.WriteLine("Sync Cargos: nenhum centro de custo no portal; é necessário ter ao menos um CC para criar cargos.");
            _logger.LogWarning("Nenhum centro de custo no portal; pulando sync de cargos.");
            return;
        }

        var json = await File.ReadAllTextAsync(file, ct);
        var items = JsonSerializer.Deserialize<List<CargoRow>>(json, JsonOptions);
        if (items is null || items.Count == 0)
        {
            _logWriter.WriteLine("Sync Cargos: nenhum registro em cargo.json.");
            return;
        }

        _logWriter.WriteLine($"Sync Cargos: enviando {items.Count} itens (PCARGO -> Cargos) para api/job-positions");

        var codeToId = await LoadExistingCargosByCodeAsync(ct);

        var created = 0;
        var updated = 0;
        var skipped = 0;
        foreach (var row in items)
        {
            try
            {
                var rawCode = NormalizeCode(row.Codigo);
                if (string.IsNullOrEmpty(rawCode)) continue;

                // API exige código com prefixo "CAR-" e mínimo 6 caracteres
                var code = ToPortalJobCode(rawCode);

                var name = (row.Nome ?? code).Trim();
                if (name.Length > 160) name = name.Substring(0, 160);
                var description = string.IsNullOrWhiteSpace(row.Descricao) ? null : row.Descricao.Trim();
                if (description != null && description.Length > 1000) description = description.Substring(0, 1000);
                // PCARGO usa Inativo (0=ativo, 1=inativo)
                var status = (row.Inativo == 1) ? 2 : 1; // Inactive = 2, Active = 1

                var body = new
                {
                    code = code.Length > 40 ? code.Substring(0, 40) : code,
                    name,
                    status,
                    centroCustoId = defaultCentroCustoId,
                    seniority = 2,
                    type = (string?)null,
                    description
                };

                if (codeToId.TryGetValue(code, out var existingId))
                {
                    var response = await _portalClient.Http.PutAsJsonAsync($"api/job-positions/{existingId}", body, JsonOptions, ct);
                    if (response.IsSuccessStatusCode)
                        updated++;
                    else
                    {
                        var msg = await response.Content.ReadAsStringAsync(ct);
                        _logWriter.WriteLine($"Sync Cargos: ERRO PUT {response.StatusCode} para Code={code}: {msg}");
                        _logger.LogWarning("PUT api/job-positions/{Id} falhou para Code={Code}: {Status} {Msg}", existingId, code, response.StatusCode, msg);
                    }
                    continue;
                }

                var postResponse = await _portalClient.Http.PostAsJsonAsync("api/job-positions", body, JsonOptions, ct);
                if (postResponse.IsSuccessStatusCode)
                {
                    var resp = await postResponse.Content.ReadFromJsonAsync<JobPositionResponse>(JsonOptions, ct);
                    if (resp != null && !string.IsNullOrEmpty(code))
                    {
                        codeToId[code] = resp.Id;
                        created++;
                    }
                }
                else
                {
                    var msg = await postResponse.Content.ReadAsStringAsync(ct);
                    _logWriter.WriteLine($"Sync Cargos: ERRO {postResponse.StatusCode} para Code={code}: {msg}");
                    _logger.LogWarning("POST api/job-positions falhou para Code={Code}: {Status} {Msg}", code, postResponse.StatusCode, msg);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao enviar cargo Code={Code}; continuando.", row.Codigo ?? "");
                _logWriter.WriteLine($"Sync Cargos: exceção para Code={row.Codigo}: {ex.Message}");
            }
        }

        _logWriter.WriteLine($"Sync Cargos: concluído. Criados: {created}, atualizados: {updated}, já existentes: {skipped}");
        _logger.LogInformation("Sync Cargos: criados={Created}, atualizados: {Updated}, já existentes: {Skipped}", created, updated, skipped);
    }

    private async Task<Guid> GetFirstCentroCustoIdAsync(CancellationToken ct)
    {
        try
        {
            var list = await _portalClient.Http.GetFromJsonAsync<List<CentroCustoItem>>("api/centros-custo?take=1", JsonOptions, ct);
            var first = list?.FirstOrDefault();
            return first?.Id ?? Guid.Empty;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao obter primeiro centro de custo do portal.");
            _logWriter.WriteLine($"Sync Cargos: falha ao obter centros de custo - {ex.Message}");
            return Guid.Empty;
        }
    }

    private async Task<Dictionary<string, Guid>> LoadExistingCargosByCodeAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var list = await _portalClient.Http.GetFromJsonAsync<PagedJobPositionsResponse>("api/job-positions?page=1&pageSize=10000", JsonOptions, ct);
            if (list?.Items != null)
                foreach (var a in list.Items)
                {
                    var key = (a.Code ?? "").Trim();
                    if (!string.IsNullOrEmpty(key))
                        map[key] = a.Id;
                }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao carregar cargos existentes do portal; assumindo nenhum.");
            _logWriter.WriteLine($"Sync Cargos: falha ao carregar cargos existentes - {ex.Message}");
        }
        return map;
    }

    private static string? NormalizeCode(string? code) => string.IsNullOrWhiteSpace(code) ? null : code.Trim();

    /// <summary>Código no portal: prefixo CAR- e mínimo 6 caracteres (ex: 1 → CAR-01).</summary>
    private static string ToPortalJobCode(string rawCode)
    {
        var part = rawCode.Length >= 2 ? rawCode : rawCode.PadLeft(2, '0');
        var full = "CAR-" + part;
        return full.Length > 40 ? full.Substring(0, 40) : full;
    }

    private string GetSchemaTablesPath()
    {
        var path = _outputOptions.SchemaTablesPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            return Path.IsPathRooted(path) ? path : Path.GetFullPath(path);
        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }

    /// <summary>Linha de cargo.json (PCARGO do RM – colunas originais).</summary>
    private sealed class CargoRow
    {
        [JsonPropertyName("CODIGO")]
        public string? Codigo { get; set; }
        [JsonPropertyName("NOME")]
        public string? Nome { get; set; }
        [JsonPropertyName("DESCRICAO")]
        public string? Descricao { get; set; }
        [JsonPropertyName("INATIVO")]
        public int Inativo { get; set; }
    }

    private sealed record CentroCustoItem(Guid Id, string Code, string Description);

    private sealed record JobPositionResponse(Guid Id, string Code, string Name);

    private sealed record PagedJobPositionsResponse(List<JobPositionItem>? Items);

    private sealed record JobPositionItem(Guid Id, string Code);
}
