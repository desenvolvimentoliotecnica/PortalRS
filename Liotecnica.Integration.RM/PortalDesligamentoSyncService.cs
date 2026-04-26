using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Sincroniza solicitações de desligamento do TOTVS RM (<c>VREQDESLIGAMENTO</c>) para
/// a tabela <c>Desligamentos</c> do Portal via <c>POST /api/desligamentos/bulk</c>.
///
/// Inclui o flag <c>CRIASUBSTITUICAO</c> que indica se foi gerada uma vaga de substituição.
/// </summary>
public sealed class PortalDesligamentoSyncService
{
    private readonly ILogger<PortalDesligamentoSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString,
    };

    /// <summary>
    /// Mapa de tipos de rescisão TOTVS RM (CODTIPORESCISAO).
    /// Liotécnica usa códigos numéricos ("1"-"9") e algumas letras ("B","N","T") em registros legados.
    /// </summary>
    private static readonly Dictionary<string, string> TiposRescisao = new(StringComparer.OrdinalIgnoreCase)
    {
        { "1", "Iniciativa do empregador sem justa causa" },
        { "2", "Iniciativa do empregador com justa causa" },
        { "3", "Iniciativa do empregado com aviso prévio" },
        { "4", "Iniciativa do empregado sem justa causa" },
        { "5", "Acordo entre as partes" },
        { "6", "Término de contrato a prazo determinado" },
        { "7", "Aposentadoria" },
        { "8", "Falecimento" },
        { "9", "Transferência" },
        { "B", "Tipo B (legado)" },
        { "N", "Tipo N (legado)" },
        { "T", "Transferência (legado)" },
    };

    public PortalDesligamentoSyncService(
        ILogger<PortalDesligamentoSyncService> logger,
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

    public async Task SyncDesligamentosFromJsonAsync(CancellationToken ct = default)
    {
        try { await SyncCoreAsync(ct); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Desligamentos: falha geral.");
            _logWriter.WriteLine($"Sync Desligamentos: falha geral - {ex.Message}");
        }
    }

    private async Task SyncCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var file = Path.Combine(path, "desligamento.json");
        if (!File.Exists(file))
        {
            _logWriter.WriteLine("Sync Desligamentos: desligamento.json não encontrado; pulando.");
            return;
        }

        var json = await File.ReadAllTextAsync(file, ct);
        var rows = JsonSerializer.Deserialize<List<DesligamentoRow>>(json, JsonOptions);
        if (rows is null || rows.Count == 0)
        {
            _logWriter.WriteLine("Sync Desligamentos: arquivo vazio.");
            return;
        }

        var items = rows
            .Where(r => r.IdReq.HasValue && !string.IsNullOrWhiteSpace(r.Chapa))
            .Select(r => new
            {
                idReqRm = r.IdReq!.Value.ToString(),
                chapaRm = (r.Chapa ?? "").Trim(),
                codMotivoRescisao = r.CodMotRescisao?.Trim(),
                motivoRescisaoDescricao = (string?)null,
                codTipoRescisao = r.CodTipoRescisao?.Trim(),
                tipoRescisaoDescricao = !string.IsNullOrWhiteSpace(r.CodTipoRescisao) && TiposRescisao.TryGetValue(r.CodTipoRescisao!.Trim(), out var desc) ? desc : null,
                gerouSubstituicao = (r.CriaSubstituicao ?? 0) == 1,
                // Datas TOTVS são "Unspecified" (sem fuso). Postgres com timestamptz exige UTC ou Local.
                // Tratamos como UTC (TOTVS Liotécnica armazena horário Brasília mas sem indicador de fuso).
                dataAbertura = AsUtc(r.DataAbertura) ?? DateTime.UtcNow,
                dataPrevista = AsUtc(r.DataPrevista),
                dataConclusao = AsUtc(r.DataConclusao),
                dataCancelamento = AsUtc(r.DataCancelamento),
                codStatus = r.CodStatus ?? 0,
                justificativa = r.Justificativa,
                numDiasAviso = r.NumDiasAviso,
            })
            .ToList();

        var body = new { items };
        _logWriter.WriteLine($"Sync Desligamentos: enviando {items.Count} desligamentos para api/desligamentos/bulk");

        var resp = await _portalClient.Http.PostAsJsonAsync("api/desligamentos/bulk", body, JsonOptions, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var msg = await resp.Content.ReadAsStringAsync(ct);
            _logWriter.WriteLine($"Sync Desligamentos: ERRO {resp.StatusCode}: {msg}");
            _logger.LogWarning("POST api/desligamentos/bulk falhou: {Status} {Msg}", resp.StatusCode, msg);
            return;
        }

        var result = await resp.Content.ReadFromJsonAsync<BulkResponse>(JsonOptions, ct);
        _logWriter.WriteLine($"Sync Desligamentos: OK — criados={result?.Created ?? 0}, atualizados={result?.Updated ?? 0}, total={result?.Total ?? 0}");
        _logger.LogInformation("Sync Desligamentos: criados={Created}, atualizados={Updated}, total={Total}",
            result?.Created ?? 0, result?.Updated ?? 0, result?.Total ?? 0);
    }

    /// <summary>Força DateTime → UTC kind sem alterar o valor (TOTVS guarda hora local sem fuso).</summary>
    private static DateTime? AsUtc(DateTime? value) =>
        value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null;

    private string GetSchemaTablesPath()
    {
        var path = _outputOptions.SchemaTablesPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            return Path.IsPathRooted(path) ? path : Path.GetFullPath(path);
        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }

    // NOTA: IDREQ no SQL Server pode vir como int — desserializamos via int? e convertemos pra string.
    private sealed class DesligamentoRow
    {
        [JsonPropertyName("IDREQ")]
        [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        public long? IdReq { get; set; }
        [JsonPropertyName("CHAPA")]
        public string? Chapa { get; set; }
        [JsonPropertyName("CODMOTRESCISAO")]
        public string? CodMotRescisao { get; set; }
        [JsonPropertyName("CODTIPORESCISAO")]
        public string? CodTipoRescisao { get; set; }
        [JsonPropertyName("CRIASUBSTITUICAO")]
        [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        public int? CriaSubstituicao { get; set; }
        [JsonPropertyName("CODSTATUS")]
        [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        public int? CodStatus { get; set; }
        [JsonPropertyName("DATAABERTURA")]
        public DateTime? DataAbertura { get; set; }
        [JsonPropertyName("DATAPREVISTA")]
        public DateTime? DataPrevista { get; set; }
        [JsonPropertyName("DATACONCLUSAO")]
        public DateTime? DataConclusao { get; set; }
        [JsonPropertyName("DATACANCELAMENTO")]
        public DateTime? DataCancelamento { get; set; }
        [JsonPropertyName("JUSTIFICATIVA")]
        public string? Justificativa { get; set; }
        [JsonPropertyName("NUMDIASAVISO")]
        public int? NumDiasAviso { get; set; }
    }

    private sealed record BulkResponse(int Created, int Updated, int Total);
}
