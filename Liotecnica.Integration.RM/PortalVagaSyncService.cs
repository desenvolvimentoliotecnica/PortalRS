using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Sincroniza vagas TOTVS RM (<c>VRSVAGAS</c>) para o Portal via
/// <c>POST /api/vagas/sync-rm/bulk</c>.
///
/// Refactor 2026-04-26 — substitui o sync antigo que chutava CC=01-LIOLOG.
///
/// Resolve a origem de cada vaga via JOIN in-memory:
///   1. <c>VREQAUMENTOQUADRO</c> (aumento de quadro) — pega CODSECAO + CODFUNCAO + CODFILIAL + IDHIERARQUIADESTINO
///   2. <c>VREQSUBSTITUICAO</c> com <c>IDREQPAI</c> apontando VREQDESLIGAMENTO ou VREQTRANSFPROMOCAO
///   3. Fallback: vaga marcada como <c>Direta</c> (CC null — UI mostra "(sem CC)")
///
/// O matching VRSVAGAS ↔ requisição-pai é via VREQAUMENTOQUADRO.IDREQ ou VREQSUBSTITUICAO.IDREQ
/// (que aparecem em VRSVAGAS via campo CODVAGA quando criada por approval do TOTVS).
/// Como o link direto não está em VRSVAGAS, usamos heurística: matching por
/// (CODFUNCAO + DATAABERTURA próxima) — refinável conforme dados reais.
/// </summary>
public sealed class PortalVagaSyncService
{
    private readonly ILogger<PortalVagaSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly RmSyncOptions _syncOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    public PortalVagaSyncService(
        ILogger<PortalVagaSyncService> logger,
        PortalApiClient portalClient,
        IOptions<OutputOptions> outputOptions,
        IOptions<RmSyncOptions> syncOptions,
        IHostEnvironment env,
        ExtractionLogWriter logWriter)
    {
        _logger = logger;
        _portalClient = portalClient;
        _outputOptions = outputOptions.Value;
        _syncOptions = syncOptions.Value;
        _env = env;
        _logWriter = logWriter;
    }

    public async Task SyncVagasFromVagaJsonAsync(CancellationToken ct = default)
    {
        try { await SyncCoreAsync(ct); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Vagas: falha geral.");
            _logWriter.WriteLine($"Sync Vagas: falha geral - {ex.Message}");
        }
    }

    private async Task SyncCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var vagaFile = Path.Combine(path, "vaga.json");
        if (!File.Exists(vagaFile))
        {
            _logWriter.WriteLine("Sync Vagas: vaga.json não encontrado; pulando.");
            return;
        }

        var vagas = JsonSerializer.Deserialize<List<VrsVagaRow>>(await File.ReadAllTextAsync(vagaFile, ct), JsonOptions);
        if (vagas is null || vagas.Count == 0)
        {
            _logWriter.WriteLine("Sync Vagas: arquivo vazio.");
            return;
        }

        // Filtra vagas em aberto (já filtramos via ExtractVagasEmAbertoOnlyAsync, mas defensivo)
        var hoje = DateTime.UtcNow.Date;
        var abertas = vagas
            .Where(v => v.Ativo == 1
                       && (!v.DataFechamento.HasValue || v.DataFechamento.Value.Date >= hoje))
            .ToList();

        var aumentoQuadro = await LoadAumentoQuadroAsync(path, ct);
        var substituicoes = await LoadSubstituicoesAsync(path, ct);

        // Lookups auxiliares
        var pfuncaoToCargo = await LoadPfuncaoCargoLookupAsync(path, ct);

        // Indexes pra resolução de origem (heurística por CODFUNCAO + janela de data)
        var aumentoByFuncao = aumentoQuadro
            .Where(a => !string.IsNullOrWhiteSpace(a.CodFuncao) && a.CodStatus == 4) // Concluída
            .GroupBy(a => a.CodFuncao!.Trim())
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.DataAbertura ?? DateTime.MinValue).ToList());

        var substByFuncao = substituicoes
            .Where(s => !string.IsNullOrWhiteSpace(s.CodFuncao) && s.CodStatus == 4)
            .GroupBy(s => s.CodFuncao!.Trim())
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.DataAbertura ?? DateTime.MinValue).ToList());

        var items = new List<object>();
        var counters = new Dictionary<string, int> { ["AumentoQuadro"]=0, ["SubstituicaoDesligamento"]=0, ["SubstituicaoPromocao"]=0, ["Direta"]=0 };

        foreach (var v in abertas)
        {
            var codFuncao = (v.CodFuncao ?? "").Trim();
            string? codCargo = null;
            if (!string.IsNullOrEmpty(codFuncao) && pfuncaoToCargo.TryGetValue(codFuncao, out var cc))
                codCargo = cc;

            string? codSecao = null;
            int? codFilial = null;
            int? idHierarquia = null;
            string origemTipo = "Direta";
            string? idReqOrigem = null;
            string? idReqDesligamento = null;

            // Tenta resolver via VREQAUMENTOQUADRO mais recente para a mesma função
            if (!string.IsNullOrEmpty(codFuncao) && aumentoByFuncao.TryGetValue(codFuncao, out var aqs))
            {
                var match = aqs.FirstOrDefault();
                if (match is not null)
                {
                    codSecao = match.CodSecao;
                    codFilial = match.CodFilial;
                    idHierarquia = match.IdHierarquiaDestino;
                    origemTipo = "AumentoQuadro";
                    idReqOrigem = match.IdReq?.ToString();
                }
            }

            // Se não achou via aumento, tenta via substituição
            if (origemTipo == "Direta" && !string.IsNullOrEmpty(codFuncao) && substByFuncao.TryGetValue(codFuncao, out var ss))
            {
                var match = ss.FirstOrDefault();
                if (match is not null)
                {
                    codSecao = match.CodSecao;
                    codFilial = match.CodFilial;
                    idHierarquia = match.IdHierarquiaDestino;
                    idReqOrigem = match.IdReq?.ToString();

                    // Tipo: depende do TIPOREQPAI (40 = desligamento? 30 = promoção? não tenho mapeamento certo).
                    // Heurística: se tem IDREQPAI e existe um VREQDESLIGAMENTO com aquele IDREQ, é desligamento.
                    if (match.TipoReqPai == 40 || match.TipoReqPai == 4)
                    {
                        origemTipo = "SubstituicaoDesligamento";
                        idReqDesligamento = match.IdReqPai?.ToString();
                    }
                    else if (match.TipoReqPai == 30 || match.TipoReqPai == 3)
                    {
                        origemTipo = "SubstituicaoPromocao";
                    }
                    else
                    {
                        origemTipo = "SubstituicaoDesligamento"; // default mais comum
                        idReqDesligamento = match.IdReqPai?.ToString();
                    }
                }
            }

            counters[origemTipo]++;

            items.Add(new
            {
                codVaga = v.CodVaga?.ToString() ?? string.Empty,
                titulo = (v.Nome ?? "").Trim(),
                dataAbertura = v.DataAbertura,
                dataFechamento = v.DataFechamento,
                quantidade = (int?)1, // VRSVAGAS não tem NUMVAGAS direto; pega da req-pai (TODO: refinar)
                remuneracao = v.Remuneracao,
                descricao = v.Complemento,
                experienciasExigidas = v.ExperienciasExigidas,
                codFuncao,
                codCargo,
                codSecao,
                codFilial,
                idHierarquiaDestinoRm = idHierarquia,
                origemTipo,
                idReqRmOrigem = idReqOrigem,
                idReqDesligamentoRm = idReqDesligamento,
            });
        }

        var body = new { items };
        _logWriter.WriteLine($"Sync Vagas: enviando {items.Count} vagas em aberto. Origens: AumentoQuadro={counters["AumentoQuadro"]}, SubstituicaoDesligamento={counters["SubstituicaoDesligamento"]}, SubstituicaoPromocao={counters["SubstituicaoPromocao"]}, Direta={counters["Direta"]}");

        var resp = await _portalClient.Http.PostAsJsonAsync("api/vagas/sync-rm/bulk", body, JsonOptions, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var msg = await resp.Content.ReadAsStringAsync(ct);
            _logWriter.WriteLine($"Sync Vagas: ERRO {resp.StatusCode}: {msg}");
            _logger.LogWarning("POST api/vagas/sync-rm/bulk falhou: {Status} {Msg}", resp.StatusCode, msg);
            return;
        }

        var result = await resp.Content.ReadFromJsonAsync<BulkResponse>(JsonOptions, ct);
        _logWriter.WriteLine($"Sync Vagas: OK — criadas={result?.Created ?? 0}, atualizadas={result?.Updated ?? 0}, total={result?.Total ?? 0}");
    }

    private async Task<List<AumentoQuadroRow>> LoadAumentoQuadroAsync(string path, CancellationToken ct)
    {
        var f = Path.Combine(path, "aumento_quadro.json");
        if (!File.Exists(f)) return new();
        return JsonSerializer.Deserialize<List<AumentoQuadroRow>>(await File.ReadAllTextAsync(f, ct), JsonOptions) ?? new();
    }

    private async Task<List<SubstituicaoRow>> LoadSubstituicoesAsync(string path, CancellationToken ct)
    {
        var f = Path.Combine(path, "substituicao.json");
        if (!File.Exists(f)) return new();
        return JsonSerializer.Deserialize<List<SubstituicaoRow>>(await File.ReadAllTextAsync(f, ct), JsonOptions) ?? new();
    }

    private async Task<Dictionary<string, string>> LoadPfuncaoCargoLookupAsync(string path, CancellationToken ct)
    {
        var f = Path.Combine(path, "funcao.json");
        if (!File.Exists(f)) return new(StringComparer.OrdinalIgnoreCase);
        var rows = JsonSerializer.Deserialize<List<PfuncaoRow>>(await File.ReadAllTextAsync(f, ct), JsonOptions) ?? new();
        return rows
            .Where(r => !string.IsNullOrWhiteSpace(r.Codigo) && !string.IsNullOrWhiteSpace(r.Cargo))
            .GroupBy(r => r.Codigo!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().Cargo!.Trim(), StringComparer.OrdinalIgnoreCase);
    }

    private string GetSchemaTablesPath()
    {
        var path = _outputOptions.SchemaTablesPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            return Path.IsPathRooted(path) ? path : Path.GetFullPath(path);
        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }

    private sealed class VrsVagaRow
    {
        [JsonPropertyName("CODVAGA")]
        public long? CodVaga { get; set; }
        [JsonPropertyName("NOME")]
        public string? Nome { get; set; }
        [JsonPropertyName("CODFUNCAO")]
        public string? CodFuncao { get; set; }
        [JsonPropertyName("ATIVO")]
        public int? Ativo { get; set; }
        [JsonPropertyName("DATAABERTURA")]
        public DateTime? DataAbertura { get; set; }
        [JsonPropertyName("DATAFECHAMENTO")]
        public DateTime? DataFechamento { get; set; }
        [JsonPropertyName("REMUNERACAO")]
        public string? Remuneracao { get; set; }
        [JsonPropertyName("COMPLEMENTO")]
        public string? Complemento { get; set; }
        [JsonPropertyName("EXPERIENCIASEXIGIDAS")]
        public string? ExperienciasExigidas { get; set; }
    }

    private sealed class AumentoQuadroRow
    {
        [JsonPropertyName("IDREQ")]
        public long? IdReq { get; set; }
        [JsonPropertyName("CODSECAO")]
        public string? CodSecao { get; set; }
        [JsonPropertyName("CODFUNCAO")]
        public string? CodFuncao { get; set; }
        [JsonPropertyName("CODFILIAL")]
        public int? CodFilial { get; set; }
        [JsonPropertyName("IDHIERARQUIADESTINO")]
        public int? IdHierarquiaDestino { get; set; }
        [JsonPropertyName("CODSTATUS")]
        public int? CodStatus { get; set; }
        [JsonPropertyName("DATAABERTURA")]
        public DateTime? DataAbertura { get; set; }
    }

    private sealed class SubstituicaoRow
    {
        [JsonPropertyName("IDREQ")]
        public long? IdReq { get; set; }
        [JsonPropertyName("IDREQPAI")]
        public long? IdReqPai { get; set; }
        [JsonPropertyName("TIPOREQPAI")]
        public int? TipoReqPai { get; set; }
        [JsonPropertyName("CODSECAO")]
        public string? CodSecao { get; set; }
        [JsonPropertyName("CODFUNCAO")]
        public string? CodFuncao { get; set; }
        [JsonPropertyName("CODFILIAL")]
        public int? CodFilial { get; set; }
        [JsonPropertyName("IDHIERARQUIADESTINO")]
        public int? IdHierarquiaDestino { get; set; }
        [JsonPropertyName("CODSTATUS")]
        public int? CodStatus { get; set; }
        [JsonPropertyName("DATAABERTURA")]
        public DateTime? DataAbertura { get; set; }
    }

    private sealed class PfuncaoRow
    {
        [JsonPropertyName("CODIGO")]
        public string? Codigo { get; set; }
        [JsonPropertyName("CARGO")]
        public string? Cargo { get; set; }
    }

    private sealed record BulkResponse(int Created, int Updated, int Total);
}
