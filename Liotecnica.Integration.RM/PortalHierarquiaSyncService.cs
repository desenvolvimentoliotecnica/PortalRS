using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Sincroniza a hierarquia/organograma do TOTVS RM (<c>VHIERARQUIA</c>) → API Portal (<c>POST /api/hierarquias/bulk</c>).
///
/// O endpoint do Portal é idempotente: faz upsert por <c>IdHierarquiaRm</c> e resolve
/// <c>HierarquiaSuperiorId</c> em duas passadas no servidor — então aqui só precisamos
/// enviar o array completo de uma vez.
/// </summary>
public sealed class PortalHierarquiaSyncService
{
    private readonly ILogger<PortalHierarquiaSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public PortalHierarquiaSyncService(
        ILogger<PortalHierarquiaSyncService> logger,
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

    public async Task SyncHierarquiasFromJsonAsync(CancellationToken ct = default)
    {
        try
        {
            await SyncCoreAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Hierarquias: falha geral.");
            _logWriter.WriteLine($"Sync Hierarquias: falha geral - {ex.Message}");
        }
    }

    private async Task SyncCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var file = Path.Combine(path, "hierarquia.json");
        if (!File.Exists(file))
        {
            _logWriter.WriteLine("Sync Hierarquias: hierarquia.json não encontrado; pulando.");
            return;
        }

        var json = await File.ReadAllTextAsync(file, ct);
        var rows = JsonSerializer.Deserialize<List<HierarquiaRow>>(json, JsonOptions);
        if (rows is null || rows.Count == 0)
        {
            _logWriter.WriteLine("Sync Hierarquias: hierarquia.json vazio.");
            return;
        }

        var items = rows
            .Where(r => r.IdHierarquia is not null)
            .Select(r => new
            {
                idHierarquiaRm = r.IdHierarquia!.Value,
                descricao = (r.DescHierarquia ?? "").Trim().Length > 200
                    ? (r.DescHierarquia ?? "").Trim().Substring(0, 200)
                    : (r.DescHierarquia ?? "").Trim(),
                idHierarquiaSuperiorRm = r.IdHierarquiaSuperior,
                estrutura = r.Estrutura,
                idNivelHierarquiaRm = r.IdNivelHierarquia,
                isActive = (r.Status ?? 1) == 1,
            })
            .Where(x => !string.IsNullOrWhiteSpace(x.descricao))
            .ToList();

        var body = new { items };
        _logWriter.WriteLine($"Sync Hierarquias: enviando {items.Count} hierarquias para api/hierarquias/bulk");

        var resp = await _portalClient.Http.PostAsJsonAsync("api/hierarquias/bulk", body, JsonOptions, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var msg = await resp.Content.ReadAsStringAsync(ct);
            _logWriter.WriteLine($"Sync Hierarquias: ERRO {resp.StatusCode}: {msg}");
            _logger.LogWarning("POST api/hierarquias/bulk falhou: {Status} {Msg}", resp.StatusCode, msg);
            return;
        }

        var result = await resp.Content.ReadFromJsonAsync<BulkUpsertResponse>(JsonOptions, ct);
        _logWriter.WriteLine($"Sync Hierarquias: OK — criadas={result?.Created ?? 0}, atualizadas={result?.Updated ?? 0}, total={result?.Total ?? 0}");
        _logger.LogInformation("Sync Hierarquias: criadas={Created}, atualizadas={Updated}, total={Total}",
            result?.Created ?? 0, result?.Updated ?? 0, result?.Total ?? 0);
    }

    private string GetSchemaTablesPath()
    {
        var path = _outputOptions.SchemaTablesPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            return Path.IsPathRooted(path) ? path : Path.GetFullPath(path);
        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }

    /// <summary>Linha de hierarquia.json (VHIERARQUIA do RM).</summary>
    private sealed class HierarquiaRow
    {
        [JsonPropertyName("IDHIERARQUIA")]
        public int? IdHierarquia { get; set; }
        [JsonPropertyName("DESCHIERARQUIA")]
        public string? DescHierarquia { get; set; }
        [JsonPropertyName("IDHIERARQUIASUPERIOR")]
        public int? IdHierarquiaSuperior { get; set; }
        [JsonPropertyName("ESTRUTURA")]
        public string? Estrutura { get; set; }
        [JsonPropertyName("IDNIVELHIERARQUIA")]
        public int? IdNivelHierarquia { get; set; }
        [JsonPropertyName("STATUS")]
        public int? Status { get; set; }
    }

    private sealed record BulkUpsertResponse(int Created, int Updated, int Total);
}
