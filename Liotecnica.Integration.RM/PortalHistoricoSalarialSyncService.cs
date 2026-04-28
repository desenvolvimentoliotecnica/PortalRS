using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Sincroniza histórico salarial do TOTVS RM (PFHSTSAL) como movimentações no portal.
/// Cada linha do PFHSTSAL vira uma FuncionarioMovimentacao com IdReqRm sintético "HSAL-{CHAPA}-{NRO}-{DTMUDANCA}".
/// Mapeamento de MOTIVO → TipoMovimentacao+TipoDescricao baseado nos códigos TOTVS Liotécnica.
/// </summary>
public sealed class PortalHistoricoSalarialSyncService
{
    private readonly ILogger<PortalHistoricoSalarialSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    public PortalHistoricoSalarialSyncService(
        ILogger<PortalHistoricoSalarialSyncService> logger,
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

    public async Task SyncAsync(CancellationToken ct = default)
    {
        try { await SyncCoreAsync(ct); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync PFHSTSAL: falha geral.");
            _logWriter.WriteLine($"Sync PFHSTSAL: falha geral - {ex.Message}");
        }
    }

    private async Task SyncCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var file = Path.Combine(path, "historico_salarial.json");
        if (!File.Exists(file))
        {
            _logWriter.WriteLine("Sync PFHSTSAL: historico_salarial.json não existe — pule extract antes.");
            return;
        }

        var rows = JsonSerializer.Deserialize<List<HistSalRow>>(await File.ReadAllTextAsync(file, ct), JsonOptions) ?? new();
        _logWriter.WriteLine($"Sync PFHSTSAL: lendo {rows.Count} linhas.");

        var items = new List<object>();
        foreach (var r in rows.Where(r => !string.IsNullOrWhiteSpace(r.Chapa) && r.DtMudanca.HasValue))
        {
            var (tipo, descr) = MapMotivo(r.Motivo);
            // Salário de origem: linha anterior do mesmo CHAPA (NROSALARIO=1) com data <
            // Vamos popular apenas o destino e deixar o origem ser deduzido depois.
            // Idempotência: IdReqRm sintético combina CHAPA + DTMUDANCA + NROSALARIO + MOTIVO.
            var idReq = $"HSAL-{r.Chapa!.Trim()}-{r.DtMudanca!.Value:yyyyMMdd}-{r.NroSalario ?? 1}-{(r.Motivo ?? "").Trim()}";
            items.Add(new
            {
                idReqRm = idReq,
                chapaRm = r.Chapa!.Trim(),
                tipoMovimentacao = tipo,
                tipoDescricao = descr,
                dataAbertura = AsUtc(r.DtMudanca) ?? DateTime.UtcNow,
                dataConclusao = AsUtc(r.DtMudanca),
                dataCancelamento = (DateTime?)null,
                codStatus = 4, // concluída
                statusDescricao = "Concluída",
                codFuncaoOrigem = (string?)null,
                codFuncaoDestino = (string?)null,
                codSecaoOrigem = (string?)null,
                codSecaoDestino = (string?)null,
                idHierarquiaOrigemRm = (int?)null,
                idHierarquiaDestinoRm = (int?)null,
                salarioOrigem = (decimal?)null,
                salarioDestino = r.Salario,
                justificativa = $"Histórico Salarial — variação {r.PercentAplicado?.ToString("0.00") ?? "0,00"}%",
                gerouSubstituicao = (bool?)null,
            });
        }

        // Inferir salarioOrigem ao olhar a linha anterior do mesmo CHAPA
        var byChapa = rows.Where(r => !string.IsNullOrWhiteSpace(r.Chapa) && r.DtMudanca.HasValue)
            .GroupBy(r => r.Chapa!.Trim())
            .ToDictionary(g => g.Key, g => g.OrderBy(x => x.DtMudanca!.Value).ThenBy(x => x.Salario ?? 0).ToList());
        // Reconstruir items com salarioOrigem da linha anterior:
        items.Clear();
        foreach (var (chapa, list) in byChapa)
        {
            decimal? prevSalario = null;
            // Contador por chave (chapa+dt+nro+motivo) pra desambiguar duplicatas (RM permite 2+ linhas no mesmo dia/motivo).
            var seqByKey = new Dictionary<string, int>();
            foreach (var r in list)
            {
                var (tipo, descr) = MapMotivo(r.Motivo);
                var baseKey = $"{chapa}-{r.DtMudanca!.Value:yyyyMMdd}-{r.NroSalario ?? 1}-{(r.Motivo ?? "").Trim()}";
                seqByKey.TryGetValue(baseKey, out var seq);
                seqByKey[baseKey] = seq + 1;
                var idReq = seq == 0 ? $"HSAL-{baseKey}" : $"HSAL-{baseKey}-{seq}";
                items.Add(new
                {
                    idReqRm = idReq,
                    chapaRm = chapa,
                    tipoMovimentacao = tipo,
                    tipoDescricao = descr,
                    dataAbertura = AsUtc(r.DtMudanca) ?? DateTime.UtcNow,
                    dataConclusao = AsUtc(r.DtMudanca),
                    dataCancelamento = (DateTime?)null,
                    codStatus = 4,
                    statusDescricao = "Concluída",
                    codFuncaoOrigem = (string?)null,
                    codFuncaoDestino = (string?)null,
                    codSecaoOrigem = (string?)null,
                    codSecaoDestino = (string?)null,
                    idHierarquiaOrigemRm = (int?)null,
                    idHierarquiaDestinoRm = (int?)null,
                    salarioOrigem = prevSalario,
                    salarioDestino = r.Salario,
                    justificativa = r.PercentAplicado is decimal p && p != 0
                        ? $"Variação {p.ToString("0.00")}%"
                        : null,
                    gerouSubstituicao = (bool?)null,
                });
                prevSalario = r.Salario;
            }
        }

        if (items.Count == 0)
        {
            _logWriter.WriteLine("Sync PFHSTSAL: nada a enviar.");
            return;
        }

        // Enviar em chunks de 500 pra não estourar payload
        const int chunkSize = 500;
        var totalCreated = 0;
        var totalUpdated = 0;
        for (int i = 0; i < items.Count; i += chunkSize)
        {
            var chunk = items.Skip(i).Take(chunkSize).ToList();
            var body = new { items = chunk };
            _logWriter.WriteLine($"Sync PFHSTSAL: enviando chunk {i / chunkSize + 1} ({chunk.Count} itens) → api/funcionarios/movimentacoes/bulk");
            var resp = await _portalClient.Http.PostAsJsonAsync("api/funcionarios/movimentacoes/bulk", body, JsonOptions, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var msg = await resp.Content.ReadAsStringAsync(ct);
                _logWriter.WriteLine($"Sync PFHSTSAL: ERRO chunk {i / chunkSize + 1}: {resp.StatusCode} {msg}");
                _logger.LogWarning("POST chunk falhou: {Status} {Msg}", resp.StatusCode, msg);
                return;
            }
            var result = await resp.Content.ReadFromJsonAsync<BulkResponse>(JsonOptions, ct);
            totalCreated += result?.Created ?? 0;
            totalUpdated += result?.Updated ?? 0;
        }
        _logWriter.WriteLine($"Sync PFHSTSAL: OK — total criados={totalCreated}, atualizados={totalUpdated}, enviados={items.Count}");
    }

    /// <summary>Mapeia código TOTVS Liotécnica → tipo+descrição.</summary>
    private static (short tipo, string descricao) MapMotivo(string? mot)
    {
        var m = (mot ?? "").Trim();
        return m switch
        {
            "00" or "01" => ((short)11, "Admissão"),
            "05" => ((short)1, "Promoção"),
            "12" => ((short)4, "Enquadramento Salarial"),
            "20" => ((short)4, "Plano de Cargos e Salários"),
            "21" => ((short)4, "Acordo Coletivo"),
            "02" => ((short)4, "Mérito"),
            "03" => ((short)4, "Reajuste"),
            "04" => ((short)4, "Aumento de Função"),
            "06" => ((short)4, "Equiparação Salarial"),
            "07" => ((short)4, "Reclassificação"),
            "08" => ((short)4, "Cláusula Coletiva"),
            "09" => ((short)4, "Antecipação"),
            "11" => ((short)4, "Reenquadramento"),
            "13" => ((short)4, "Ajuste de Faixa"),
            "15" => ((short)4, "Aumento Espontâneo"),
            "16" => ((short)4, "Avaliação"),
            "17" => ((short)4, "Mudança de Função"),
            "18" => ((short)4, "Transferência Salarial"),
            "19" => ((short)4, "Tabela Salarial"),
            _ => ((short)4, $"Mudança Salarial (motivo {m})"),
        };
    }

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

    private sealed class HistSalRow
    {
        [JsonPropertyName("CHAPA")] public string? Chapa { get; set; }
        [JsonPropertyName("DTMUDANCA")] public DateTime? DtMudanca { get; set; }
        [JsonPropertyName("MOTIVO")] public string? Motivo { get; set; }
        [JsonPropertyName("NROSALARIO")] public int? NroSalario { get; set; }
        [JsonPropertyName("SALARIO")] public decimal? Salario { get; set; }
        [JsonPropertyName("PERCENTAPLICADO")] public decimal? PercentAplicado { get; set; }
    }

    private sealed record BulkResponse(int Created, int Updated, int Total);
}
