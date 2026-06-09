using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// LUC-122 — sincroniza histórico de movimentações de funcionário consolidando 3 fontes:
///   - VREQTRANSFPROMOCAO (promoção / transferência / mudança de função)
///   - VREQDESLIGAMENTO (rescisão — quando o funcionário sai)
///   - VREQAUMENTOQUADRO (quando o funcionário é requisitante de vaga nova — opcional)
///
/// Tipos:
///   1=Promoção, 2=Transferência, 3=MudançaFuncao, 4=AumentoSalarial,
///   5=Desligamento, 6=AumentoQuadro, 7=Substituição
///
/// Endpoint: POST /api/funcionarios/movimentacoes/bulk (idempotente por IdReqRm).
/// </summary>
public sealed class PortalFuncionarioMovimentacaoSyncService
{
    private readonly ILogger<PortalFuncionarioMovimentacaoSyncService> _logger;
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

    public PortalFuncionarioMovimentacaoSyncService(
        ILogger<PortalFuncionarioMovimentacaoSyncService> logger,
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

    public async Task SyncMovimentacoesFromJsonAsync(CancellationToken ct = default)
    {
        try { await SyncCoreAsync(ct); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Movimentações: falha geral.");
            _logWriter.WriteLine($"Sync Movimentações: falha geral - {ex.Message}");
        }
    }

    private async Task SyncCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var items = new List<object>();
        var nomeByChapa = await LoadNomeByChapaAsync(path, ct);
        var funcaoNomeByCodigo = await LoadFuncaoNomeByCodigoAsync(path, ct);

        // ── VREQTRANSFPROMOCAO ── (CHAPA + função origem/destino + seção origem/destino + hierarquia + salário)
        var promoFile = Path.Combine(path, "transf_promocao.json");
        if (File.Exists(promoFile))
        {
            var rows = JsonSerializer.Deserialize<List<TransfPromocaoRow>>(await File.ReadAllTextAsync(promoFile, ct), JsonOptions) ?? new();
            foreach (var r in rows.Where(r => !string.IsNullOrWhiteSpace(r.Chapa) && r.IdReq.HasValue))
            {
                var tipo = r.CodMotMudFuncao?.Trim() switch
                {
                    "05" or "5" => (short)1, // Promoção
                    "01" or "1" => (short)3, // Mudança de função
                    _ => (short)2, // Transferência (default)
                };
                var tipoDescr = tipo == 1 ? "Promoção" : tipo == 3 ? "Mudança de função" : "Transferência";
                items.Add(new
                {
                    idReqRm = r.IdReq!.Value.ToString(),
                    chapaRm = r.Chapa!.Trim(),
                    tipoMovimentacao = tipo,
                    tipoDescricao = tipoDescr,
                    dataAbertura = AsUtc(r.DataAbertura) ?? DateTime.UtcNow,
                    dataConclusao = AsUtc(r.DataConclusao),
                    dataCancelamento = AsUtc(r.DataCancelamento),
                    codStatus = r.CodStatus ?? 0,
                    statusDescricao = MapStatus(r.CodStatus),
                    codFuncaoOrigem = r.CodFuncaoOrg?.Trim(),
                    codFuncaoDestino = r.CodFuncao?.Trim(),
                    funcaoOrigemNome = ResolveFuncaoNome(r.CodFuncaoOrg, funcaoNomeByCodigo),
                    funcaoDestinoNome = ResolveFuncaoNome(r.CodFuncao, funcaoNomeByCodigo),
                    codSecaoOrigem = r.CodSecaoOrg?.Trim(),
                    codSecaoDestino = r.CodSecao?.Trim(),
                    idHierarquiaOrigemRm = r.IdHierarquiaOrigem,
                    idHierarquiaDestinoRm = r.IdHierarquiaDestino,
                    salarioOrigem = r.VlrSalarioOrg,
                    salarioDestino = r.VlrSalario,
                    justificativa = r.Justificativa,
                    gestorHistoricoChapaRm = r.ChapaRequisitante?.Trim(),
                    gestorHistoricoNome = ResolveNomeByChapa(r.ChapaRequisitante, nomeByChapa),
                    gerouSubstituicao = (bool?)null,
                });
            }
        }

        // ── VREQDESLIGAMENTO ── (CHAPA + flag GerouSubstituicao)
        var deslFile = Path.Combine(path, "desligamento.json");
        if (File.Exists(deslFile))
        {
            var rows = JsonSerializer.Deserialize<List<DesligamentoRow>>(await File.ReadAllTextAsync(deslFile, ct), JsonOptions) ?? new();
            foreach (var r in rows.Where(r => !string.IsNullOrWhiteSpace(r.Chapa) && r.IdReq.HasValue))
            {
                items.Add(new
                {
                    idReqRm = "DESL-" + r.IdReq!.Value.ToString(), // prefixo evita colisão de IdReq com transf_promocao
                    chapaRm = r.Chapa!.Trim(),
                    tipoMovimentacao = (short)5, // Desligamento
                    tipoDescricao = "Desligamento",
                    dataAbertura = AsUtc(r.DataAbertura) ?? DateTime.UtcNow,
                    dataConclusao = AsUtc(r.DataConclusao),
                    dataCancelamento = AsUtc(r.DataCancelamento),
                    codStatus = r.CodStatus ?? 0,
                    statusDescricao = MapStatus(r.CodStatus),
                    codFuncaoOrigem = (string?)null,
                    codFuncaoDestino = (string?)null,
                    funcaoOrigemNome = (string?)null,
                    funcaoDestinoNome = (string?)null,
                    codSecaoOrigem = (string?)null,
                    codSecaoDestino = (string?)null,
                    idHierarquiaOrigemRm = (int?)null,
                    idHierarquiaDestinoRm = (int?)null,
                    salarioOrigem = (decimal?)null,
                    salarioDestino = (decimal?)null,
                    justificativa = r.Justificativa,
                    gestorHistoricoChapaRm = r.ChapaRequisitante?.Trim(),
                    gestorHistoricoNome = ResolveNomeByChapa(r.ChapaRequisitante, nomeByChapa),
                    gerouSubstituicao = (r.CriaSubstituicao ?? 0) == 1,
                });
            }
        }

        if (items.Count == 0)
        {
            _logWriter.WriteLine("Sync Movimentações: nenhum registro pra enviar.");
            return;
        }

        var body = new { items };
        _logWriter.WriteLine($"Sync Movimentações: enviando {items.Count} movimentações para api/funcionarios/movimentacoes/bulk");

        var resp = await _portalClient.Http.PostAsJsonAsync("api/funcionarios/movimentacoes/bulk", body, JsonOptions, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var msg = await resp.Content.ReadAsStringAsync(ct);
            _logWriter.WriteLine($"Sync Movimentações: ERRO {resp.StatusCode}: {msg}");
            _logger.LogWarning("POST api/funcionarios/movimentacoes/bulk falhou: {Status} {Msg}", resp.StatusCode, msg);
            return;
        }

        var result = await resp.Content.ReadFromJsonAsync<BulkResponse>(JsonOptions, ct);
        _logWriter.WriteLine($"Sync Movimentações: OK — criadas={result?.Created ?? 0}, atualizadas={result?.Updated ?? 0}, total={result?.Total ?? 0}");
    }

    private static DateTime? AsUtc(DateTime? value) =>
        value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null;

    private static string MapStatus(int? codStatus) => codStatus switch
    {
        1 => "Aberta", 2 => "Em análise", 3 => "Aprovada",
        4 => "Concluída", 5 => "Em andamento", 6 => "Cancelada", 7 => "Rejeitada",
        _ => $"Status {codStatus}",
    };

    private string GetSchemaTablesPath()
    {
        var path = _outputOptions.SchemaTablesPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            return Path.IsPathRooted(path) ? path : Path.GetFullPath(path);
        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }

    private sealed class TransfPromocaoRow
    {
        [JsonPropertyName("IDREQ")] public long? IdReq { get; set; }
        [JsonPropertyName("CHAPA")] public string? Chapa { get; set; }
        [JsonPropertyName("CODMOTMUDFUNCAO")] public string? CodMotMudFuncao { get; set; }
        [JsonPropertyName("DATAABERTURA")] public DateTime? DataAbertura { get; set; }
        [JsonPropertyName("DATACONCLUSAO")] public DateTime? DataConclusao { get; set; }
        [JsonPropertyName("DATACANCELAMENTO")] public DateTime? DataCancelamento { get; set; }
        [JsonPropertyName("CHAPAREQUISITANTE")] public string? ChapaRequisitante { get; set; }
        [JsonPropertyName("CODSTATUS")] public int? CodStatus { get; set; }
        [JsonPropertyName("CODFUNCAO")] public string? CodFuncao { get; set; }
        [JsonPropertyName("CODFUNCAOORG")] public string? CodFuncaoOrg { get; set; }
        [JsonPropertyName("CODSECAO")] public string? CodSecao { get; set; }
        [JsonPropertyName("CODSECAOORG")] public string? CodSecaoOrg { get; set; }
        [JsonPropertyName("IDHIERARQUIAORIGEM")] public int? IdHierarquiaOrigem { get; set; }
        [JsonPropertyName("IDHIERARQUIADESTINO")] public int? IdHierarquiaDestino { get; set; }
        [JsonPropertyName("VLRSALARIO")] public decimal? VlrSalario { get; set; }
        [JsonPropertyName("VLRSALARIOORG")] public decimal? VlrSalarioOrg { get; set; }
        [JsonPropertyName("JUSTIFICATIVA")] public string? Justificativa { get; set; }
    }

    private sealed class DesligamentoRow
    {
        [JsonPropertyName("IDREQ")] public long? IdReq { get; set; }
        [JsonPropertyName("CHAPA")] public string? Chapa { get; set; }
        [JsonPropertyName("CRIASUBSTITUICAO")]
        [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        public int? CriaSubstituicao { get; set; }
        [JsonPropertyName("CHAPAREQUISITANTE")] public string? ChapaRequisitante { get; set; }
        [JsonPropertyName("DATAABERTURA")] public DateTime? DataAbertura { get; set; }
        [JsonPropertyName("DATACONCLUSAO")] public DateTime? DataConclusao { get; set; }
        [JsonPropertyName("DATACANCELAMENTO")] public DateTime? DataCancelamento { get; set; }
        [JsonPropertyName("CODSTATUS")]
        [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        public int? CodStatus { get; set; }
        [JsonPropertyName("JUSTIFICATIVA")] public string? Justificativa { get; set; }
    }

    private sealed record BulkResponse(int Created, int Updated, int Total);

    private static string? ResolveNomeByChapa(string? chapa, Dictionary<string, string> nomeByChapa)
    {
        if (string.IsNullOrWhiteSpace(chapa)) return null;
        return nomeByChapa.TryGetValue(chapa.Trim(), out var nome) ? nome : null;
    }

    private static string? ResolveFuncaoNome(string? codigo, Dictionary<string, string> nomeByCodigo)
    {
        if (string.IsNullOrWhiteSpace(codigo)) return null;
        return nomeByCodigo.TryGetValue(codigo.Trim(), out var nome) ? nome : null;
    }

    private async Task<Dictionary<string, string>> LoadFuncaoNomeByCodigoAsync(string path, CancellationToken ct)
    {
        var funcaoPath = Path.Combine(path, "funcao.json");
        if (!File.Exists(funcaoPath))
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var funcoes = JsonSerializer.Deserialize<List<FuncaoNomeRow>>(
            await File.ReadAllTextAsync(funcaoPath, ct), JsonOptions) ?? new();

        return funcoes
            .Where(f => !string.IsNullOrWhiteSpace(f.Codigo) && !string.IsNullOrWhiteSpace(f.Nome))
            .GroupBy(f => f.Codigo!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(f => f.Nome!.Length).First().Nome!.Trim(),
                StringComparer.OrdinalIgnoreCase);
    }

    private async Task<Dictionary<string, string>> LoadNomeByChapaAsync(string path, CancellationToken ct)
    {
        var pessoaPath = Path.Combine(path, "pessoa.json");
        var funcPath = Path.Combine(path, "funcionario.json");
        if (!File.Exists(pessoaPath) || !File.Exists(funcPath))
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var pessoas = JsonSerializer.Deserialize<List<PessoaNomeRow>>(
            await File.ReadAllTextAsync(pessoaPath, ct), JsonOptions) ?? new();
        var nomeByCodigoPessoa = pessoas
            .Where(p => p.Codigo.HasValue && !string.IsNullOrWhiteSpace(p.Nome))
            .GroupBy(p => p.Codigo!.Value)
            .ToDictionary(g => g.Key, g => g.First().Nome!.Trim());

        var funcionarios = JsonSerializer.Deserialize<List<FuncionarioNomeRow>>(
            await File.ReadAllTextAsync(funcPath, ct), JsonOptions) ?? new();
        var nomeByChapa = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var funcionario in funcionarios)
        {
            if (string.IsNullOrWhiteSpace(funcionario.Chapa) || !funcionario.CodPessoa.HasValue)
                continue;
            if (nomeByCodigoPessoa.TryGetValue(funcionario.CodPessoa.Value, out var nome))
                nomeByChapa[funcionario.Chapa.Trim()] = nome;
        }

        return nomeByChapa;
    }

    private sealed class PessoaNomeRow
    {
        [JsonPropertyName("CODIGO")] public int? Codigo { get; set; }
        [JsonPropertyName("NOME")] public string? Nome { get; set; }
    }

    private sealed class FuncionarioNomeRow
    {
        [JsonPropertyName("CHAPA")] public string? Chapa { get; set; }
        [JsonPropertyName("CODPESSOA")] public int? CodPessoa { get; set; }
    }

    private sealed class FuncaoNomeRow
    {
        [JsonPropertyName("CODIGO")] public string? Codigo { get; set; }
        [JsonPropertyName("NOME")] public string? Nome { get; set; }
    }
}
