using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Sincroniza funcionários do TOTVS RM (<c>dbo.PFUNC</c>) para a API do Portal
/// (<c>POST /api/funcionarios/sync-rm/bulk</c>).
///
/// Fluxo (refactor 2026-04-26 — substituiu o fallback antigo PPESSOA→Funcionário):
/// 1. Lê <c>funcionario.json</c> (= PFUNC) — fonte autoritativa de funcionários TOTVS Liotécnica.
/// 2. Filtra apenas <c>CODSITUACAO IN ('A','F','P')</c> (~637 ativos de 5314).
/// 3. JOIN in-memory com <c>pessoa.json</c> (PPESSOA) via <c>CODPESSOA</c> pra obter
///    nome real, e-mail real, CPF, telefone, data de nascimento.
/// 4. JOIN in-memory com <c>funcao.json</c> (PFUNCAO) pra resolver
///    <c>PFUNC.CODFUNCAO → PFUNCAO.CARGO</c> (= código do PCARGO no Portal).
/// 5. JOIN in-memory com <c>transf_promocao.json</c> (VREQTRANSFPROMOCAO) pra obter
///    a última hierarquia destino aprovada por CHAPA (38% dos ativos têm).
/// 6. Envia bulk com chaves crus (códigos RM) — endpoint resolve FKs internamente.
/// </summary>
public sealed class PortalFuncionarioSyncService
{
    private readonly ILogger<PortalFuncionarioSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;
    private readonly RmSyncOptions _syncOptions;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    public PortalFuncionarioSyncService(
        ILogger<PortalFuncionarioSyncService> logger,
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

    public async Task SyncFuncionariosFromFuncionarioJsonAsync(CancellationToken ct = default)
    {
        try { await SyncCoreAsync(ct); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Funcionários: falha geral.");
            _logWriter.WriteLine($"Sync Funcionários: falha geral - {ex.Message}");
        }
    }

    private async Task SyncCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var pfuncFile = Path.Combine(path, "funcionario.json");
        if (!File.Exists(pfuncFile))
        {
            _logWriter.WriteLine("Sync Funcionários: funcionario.json não encontrado; pulando.");
            return;
        }

        var pfuncJson = await File.ReadAllTextAsync(pfuncFile, ct);
        var pfuncRows = JsonSerializer.Deserialize<List<PfuncRow>>(pfuncJson, JsonOptions);
        if (pfuncRows is null || pfuncRows.Count == 0)
        {
            _logWriter.WriteLine("Sync Funcionários: PFUNC vazio.");
            return;
        }

        var pessoaByCodigo = await LoadPessoaLookupAsync(path, ct);
        var pfuncaoCargoByCodigo = await LoadPfuncaoCargoLookupAsync(path, ct);
        var ultimaHierarquiaByChapa = await LoadUltimaHierarquiaPorChapaAsync(path, ct);

        // 2026-04-26: trazemos TODOS os PFUNC (ativos + desligados/inativos) pra:
        //   - Vincular Desligamento.FuncionarioId mesmo de quem saiu (CODSITUACAO=D)
        //   - Permitir histórico/auditoria
        // O endpoint sync-rm/bulk recebe codSituacao e mapeia pra Funcionario.Status:
        //   A,F,P → Active(1)  |  D,I,outros → Inactive(2)
        // Tela de Funcionários filtra Active por default; toggle pra mostrar inativos.
        // Dedup por CHAPA — TOTVS pode ter PFUNC duplicado em schemas TOTVSAUDIT.
        // Quando há mais de 1, preferimos o registro ativo (CODSITUACAO IN A,F,P).
        var todos = pfuncRows
            .Where(r => !string.IsNullOrWhiteSpace(r.Chapa))
            .GroupBy(r => r.Chapa!.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(g => g.OrderByDescending(r => new[] { "A", "F", "P" }.Contains((r.CodSituacao ?? "").Trim().ToUpperInvariant())).First())
            .ToList();
        var ativosCount = todos.Count(r => new[] { "A", "F", "P" }.Contains((r.CodSituacao ?? "").Trim().ToUpperInvariant()));
        _logWriter.WriteLine($"Sync Funcionários: PFUNC total={pfuncRows.Count}, com chapa={todos.Count}, ativos={ativosCount}, inativos={todos.Count - ativosCount}");

        var items = todos.Select(r =>
        {
            var pessoa = r.CodPessoa.HasValue && pessoaByCodigo.TryGetValue(r.CodPessoa.Value, out var p) ? p : null;

            string? codCargo = null;
            if (!string.IsNullOrWhiteSpace(r.CodFuncao) && pfuncaoCargoByCodigo.TryGetValue(r.CodFuncao.Trim(), out var pc))
                // O PortalCargoSyncService aplica prefixo "CAR-" + pad 2 chars no Code.
                // Aqui tem que aplicar mesma transformação pra o lookup CodCargo → JobPosition.Code casar.
                codCargo = PortalCargoSyncService.ToPortalJobCode(pc);

            int? idHierarquiaDestino = null;
            if (ultimaHierarquiaByChapa.TryGetValue(r.Chapa!.Trim(), out var hier))
                idHierarquiaDestino = hier;

            var nome = (pessoa?.Nome ?? "").Trim();
            if (nome.Length > 160) nome = nome.Substring(0, 160);

            return new
            {
                chapa = r.Chapa.Trim(),
                nome = string.IsNullOrEmpty(nome) ? "(sem nome)" : nome,
                email = string.IsNullOrWhiteSpace(pessoa?.Email) ? null : pessoa!.Email!.Trim().ToLowerInvariant(),
                cpf = string.IsNullOrWhiteSpace(pessoa?.Cpf) ? null : pessoa!.Cpf!.Trim(),
                telefone = pessoa?.Telefone1?.Trim(),
                dataAdmissao = r.DataAdmissao.HasValue ? DateOnly.FromDateTime(r.DataAdmissao.Value) : (DateOnly?)null,
                dataNascimento = pessoa?.DtNascimento.HasValue == true ? DateOnly.FromDateTime(pessoa.DtNascimento.Value) : (DateOnly?)null,
                codSituacao = r.CodSituacao,
                codSecao = r.CodSecao,
                codFuncao = r.CodFuncao,
                codCargo,
                codFilial = r.CodFilial,
                idHierarquiaDestinoRm = idHierarquiaDestino,
                codPessoa = r.CodPessoa,
            };
        }).ToList();

        // Cap dedicado pra funcionários (sem confundir com MaxPessoasToSync que é só pra PPESSOA bulk).
        // Default null = sem cap (envia todos os ~637 ativos).
        if (_syncOptions.MaxFuncionariosToSync is int cap && cap > 0 && items.Count > cap)
        {
            _logWriter.WriteLine($"Sync Funcionários: limitando envio a {cap} (de {items.Count}) via RmSync:MaxFuncionariosToSync.");
            items = items.Take(cap).ToList();
        }

        var body = new { items };
        _logWriter.WriteLine($"Sync Funcionários: enviando {items.Count} funcionários ativos para api/funcionarios/sync-rm/bulk");

        var resp = await _portalClient.Http.PostAsJsonAsync("api/funcionarios/sync-rm/bulk", body, JsonOptions, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var msg = await resp.Content.ReadAsStringAsync(ct);
            _logWriter.WriteLine($"Sync Funcionários: ERRO {resp.StatusCode}: {msg}");
            _logger.LogWarning("POST api/funcionarios/sync-rm/bulk falhou: {Status} {Msg}", resp.StatusCode, msg);
            return;
        }

        var result = await resp.Content.ReadFromJsonAsync<BulkResponse>(JsonOptions, ct);
        _logWriter.WriteLine($"Sync Funcionários: OK — criados={result?.Created ?? 0}, atualizados={result?.Updated ?? 0}, pulados ativos={result?.Skipped ?? 0}, pulados inativos={result?.SkippedInactive ?? 0}, total enviado={result?.Total ?? 0}");
        _logger.LogInformation("Sync Funcionários: criados={Created}, atualizados={Updated}, totalAtivos={TotalAtivos}",
            result?.Created ?? 0, result?.Updated ?? 0, result?.Total ?? 0);
    }

    private async Task<Dictionary<int, PessoaRow>> LoadPessoaLookupAsync(string path, CancellationToken ct)
    {
        var file = Path.Combine(path, "pessoa.json");
        if (!File.Exists(file)) return new();
        var json = await File.ReadAllTextAsync(file, ct);
        var rows = JsonSerializer.Deserialize<List<PessoaRow>>(json, JsonOptions) ?? new();
        return rows.Where(p => p.Codigo.HasValue).ToDictionary(p => p.Codigo!.Value, p => p);
    }

    private async Task<Dictionary<string, string>> LoadPfuncaoCargoLookupAsync(string path, CancellationToken ct)
    {
        var file = Path.Combine(path, "funcao.json");
        if (!File.Exists(file)) return new(StringComparer.OrdinalIgnoreCase);
        var json = await File.ReadAllTextAsync(file, ct);
        var rows = JsonSerializer.Deserialize<List<PfuncaoRow>>(json, JsonOptions) ?? new();
        return rows
            .Where(r => !string.IsNullOrWhiteSpace(r.Codigo) && !string.IsNullOrWhiteSpace(r.Cargo))
            .GroupBy(r => r.Codigo!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().Cargo!.Trim(), StringComparer.OrdinalIgnoreCase);
    }

    private async Task<Dictionary<string, int>> LoadUltimaHierarquiaPorChapaAsync(string path, CancellationToken ct)
    {
        var file = Path.Combine(path, "transf_promocao.json");
        if (!File.Exists(file)) return new(StringComparer.OrdinalIgnoreCase);
        var json = await File.ReadAllTextAsync(file, ct);
        var rows = JsonSerializer.Deserialize<List<TransfPromocaoRow>>(json, JsonOptions) ?? new();
        return rows
            .Where(r => !string.IsNullOrWhiteSpace(r.Chapa)
                        && r.IdHierarquiaDestino.HasValue
                        && r.CodStatus == 4)
            .GroupBy(r => r.Chapa!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(x => x.DataConclusao ?? DateTime.MinValue).First().IdHierarquiaDestino!.Value,
                StringComparer.OrdinalIgnoreCase);
    }

    private string GetSchemaTablesPath()
    {
        var path = _outputOptions.SchemaTablesPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            return Path.IsPathRooted(path) ? path : Path.GetFullPath(path);
        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }

    private sealed class PfuncRow
    {
        [JsonPropertyName("CHAPA")]
        public string? Chapa { get; set; }
        [JsonPropertyName("CODPESSOA")]
        public int? CodPessoa { get; set; }
        [JsonPropertyName("CODSECAO")]
        public string? CodSecao { get; set; }
        [JsonPropertyName("CODFUNCAO")]
        public string? CodFuncao { get; set; }
        [JsonPropertyName("CODFILIAL")]
        public int? CodFilial { get; set; }
        [JsonPropertyName("CODSITUACAO")]
        public string? CodSituacao { get; set; }
        [JsonPropertyName("DATAADMISSAO")]
        public DateTime? DataAdmissao { get; set; }
    }

    private sealed class PessoaRow
    {
        [JsonPropertyName("CODIGO")]
        public int? Codigo { get; set; }
        [JsonPropertyName("NOME")]
        public string? Nome { get; set; }
        [JsonPropertyName("CPF")]
        public string? Cpf { get; set; }
        [JsonPropertyName("EMAIL")]
        public string? Email { get; set; }
        [JsonPropertyName("TELEFONE1")]
        public string? Telefone1 { get; set; }
        [JsonPropertyName("DTNASCIMENTO")]
        public DateTime? DtNascimento { get; set; }
    }

    private sealed class PfuncaoRow
    {
        [JsonPropertyName("CODIGO")]
        public string? Codigo { get; set; }
        [JsonPropertyName("CARGO")]
        public string? Cargo { get; set; }
    }

    private sealed class TransfPromocaoRow
    {
        [JsonPropertyName("CHAPA")]
        public string? Chapa { get; set; }
        [JsonPropertyName("IDHIERARQUIADESTINO")]
        public int? IdHierarquiaDestino { get; set; }
        [JsonPropertyName("DATACONCLUSAO")]
        public DateTime? DataConclusao { get; set; }
        [JsonPropertyName("CODSTATUS")]
        public int? CodStatus { get; set; }
    }

    private sealed record BulkResponse(int Created, int Updated, int Skipped, int SkippedInactive, int Total);
}
