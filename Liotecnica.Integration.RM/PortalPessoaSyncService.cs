using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Envia a Pessoa do RM (PPESSOA / pessoa.json) para a API do Portal como Pessoa (api/pessoas).
/// </summary>
public sealed class PortalPessoaSyncService
{
    private readonly ILogger<PortalPessoaSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;
    private readonly RmSyncOptions _syncOptions;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public PortalPessoaSyncService(
        ILogger<PortalPessoaSyncService> logger,
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

    /// <summary>
    /// Lê pessoa.json (PPESSOA) e envia para api/pessoas. Não propaga exceções.
    /// </summary>
    public async Task SyncPessoasFromPessoaJsonAsync(CancellationToken ct = default)
    {
        try
        {
            await SyncPessoasFromPessoaJsonCoreAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Pessoas: falha geral.");
            _logWriter.WriteLine($"Sync Pessoas: falha geral - {ex.Message}");
        }
    }

    private async Task SyncPessoasFromPessoaJsonCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var file = Path.Combine(path, "pessoa.json");
        if (!File.Exists(file))
        {
            _logWriter.WriteLine("Sync Pessoas: arquivo pessoa.json não encontrado; pulando envio.");
            _logger.LogWarning("Arquivo {File} não encontrado; pulando sync de pessoas.", file);
            return;
        }

        var json = await File.ReadAllTextAsync(file, ct);
        var items = JsonSerializer.Deserialize<List<PessoaRow>>(json, JsonOptions);
        if (items is null || items.Count == 0)
        {
            _logWriter.WriteLine("Sync Pessoas: nenhum registro em pessoa.json.");
            return;
        }

        // Cap opcional via RmSync:MaxPessoasToSync — usado no modo sync-one pra validar
        // o pipeline rapidamente (sem isso são ~7938 POSTs a 1-3s cada na Liotécnica).
        if (_syncOptions.MaxPessoasToSync is int cap && cap > 0 && items.Count > cap)
        {
            _logWriter.WriteLine($"Sync Pessoas: limitando envio a {cap} (de {items.Count}) via RmSync:MaxPessoasToSync.");
            _logger.LogInformation("Sync Pessoas: aplicando cap MaxPessoasToSync={Cap} (total disponível={Total}).", cap, items.Count);
            items = items.Take(cap).ToList();
        }

        _logWriter.WriteLine($"Sync Pessoas: enviando {items.Count} itens (PPESSOA -> api/pessoas)");

        var emailToId = await LoadExistingPessoasAsync(ct);
        var attemptedThisBatch = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var created = 0;
        var updated = 0;
        var skipped = 0;
        foreach (var row in items)
        {
            try
            {
                var nome = (row.Nome ?? "").Trim();
                if (string.IsNullOrEmpty(nome)) continue;

                // Bloco 10 (refactor 2026-04-26): NÃO criamos mais email fake "codigo<X>@rm.sync".
                // PPESSOA real tem ~41% sem email — esses ficam Email=NULL no Portal.
                // Chave de dedup vira CPF + Nome (CPF é mais estável que email pra pessoas legadas).
                var email = (row.Email ?? "").Trim();
                var hasRealEmail = !string.IsNullOrEmpty(email);
                var key = hasRealEmail
                    ? email.ToLowerInvariant()
                    : $"cpf:{(row.Cpf ?? "").Trim()}|codigo:{row.Codigo}"; // chave interna pro dedup
                if (string.IsNullOrEmpty(key)) continue;

                // API usa JsonStringEnumConverter: enviar origem como string "Funcionario"
                var body = new
                {
                    nome = nome.Length > 160 ? nome.Substring(0, 160) : nome,
                    email = hasRealEmail ? (email.Length > 180 ? email.Substring(0, 180) : email) : null,
                    fone = Trunc(row.Telefone1, 40),
                    cidade = Trunc(row.Cidade, 120),
                    uf = Trunc(row.Estado, 2),
                    linkedinUrl = (string?)null,
                    resumoProfissional = (string?)null,
                    obs = Trunc(row.ObsPessoa, 2000),
                    cep = Trunc(row.Cep, 20),
                    logradouro = Trunc(row.Rua, 200),
                    numero = Trunc(row.Numero, 40),
                    bairro = Trunc(row.Bairro, 120),
                    complemento = Trunc(row.Complemento, 120),
                    cpf = Trunc(row.Cpf, 14),
                    rg = Trunc(row.CartIdentidade, 20),
                    foneContato = Trunc(row.Telefone2, 40),
                    dataNascimento = row.DtNascimento,
                    origem = "Funcionario"
                };

                if (emailToId.TryGetValue(key, out var existingId))
                {
                    var response = await _portalClient.Http.PutAsJsonAsync($"api/pessoas/{existingId}", body, JsonOptions, ct);
                    if (response.IsSuccessStatusCode)
                        updated++;
                    else
                    {
                        var msg = await response.Content.ReadAsStringAsync(ct);
                        _logWriter.WriteLine($"Sync Pessoas: ERRO PUT {response.StatusCode} para Email={email}: {msg}");
                        _logger.LogWarning("PUT api/pessoas/{Id} falhou para Email={Email}: {Status} {Msg}", existingId, email, response.StatusCode, msg);
                    }
                    continue;
                }
                if (attemptedThisBatch.Contains(key))
                {
                    skipped++;
                    continue;
                }
                attemptedThisBatch.Add(key);

                var postResponse = await _portalClient.Http.PostAsJsonAsync("api/pessoas", body, JsonOptions, ct);
                if (postResponse.IsSuccessStatusCode)
                {
                    var p = await postResponse.Content.ReadFromJsonAsync<PessoaResponse>(JsonOptions, ct);
                    if (p != null && !string.IsNullOrEmpty(p.Email))
                    {
                        emailToId[p.Email.Trim().ToLowerInvariant()] = p.Id;
                        created++;
                    }
                }
                else
                {
                    var msg = await postResponse.Content.ReadAsStringAsync(ct);
                    _logWriter.WriteLine($"Sync Pessoas: ERRO {postResponse.StatusCode} para Email={email}: {msg}");
                    _logger.LogWarning("POST api/pessoas falhou para Email={Email}: {Status} {Msg}", email, postResponse.StatusCode, msg);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao enviar pessoa Codigo={Codigo}; continuando.", row.Codigo);
                _logWriter.WriteLine($"Sync Pessoas: exceção para Codigo={row.Codigo}: {ex.Message}");
            }
        }

        _logWriter.WriteLine($"Sync Pessoas: concluído. Criadas: {created}, atualizadas: {updated}, já existentes: {skipped}");
        _logger.LogInformation("Sync Pessoas: criadas={Created}, atualizadas: {Updated}, já existentes: {Skipped}", created, updated, skipped);
    }

    private async Task<Dictionary<string, Guid>> LoadExistingPessoasAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var page = 1;
            const int pageSize = 500;
            while (true)
            {
                var paged = await _portalClient.Http.GetFromJsonAsync<PessoaPagedResponse>(
                    $"api/pessoas?page={page}&pageSize={pageSize}", JsonOptions, ct);
                if (paged?.Items == null || paged.Items.Count == 0)
                    break;
                foreach (var p in paged.Items)
                {
                    var key = (p.Email ?? "").Trim().ToLowerInvariant();
                    if (!string.IsNullOrEmpty(key))
                        map[key] = p.Id;
                }
                if (page * pageSize >= paged.TotalCount)
                    break;
                page++;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao carregar pessoas existentes do portal; assumindo nenhuma.");
            _logWriter.WriteLine($"Sync Pessoas: falha ao carregar existentes - {ex.Message}");
        }
        return map;
    }

    private static string? Trunc(string? value, int max) =>
        string.IsNullOrEmpty(value) ? null : (value.Length <= max ? value : value.Substring(0, max));

    private string GetSchemaTablesPath()
    {
        var path = _outputOptions.SchemaTablesPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            return Path.IsPathRooted(path) ? path : Path.GetFullPath(path);
        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }

    /// <summary>Linha de pessoa.json (PPESSOA do RM – colunas originais).</summary>
    private sealed class PessoaRow
    {
        [JsonPropertyName("CODIGO")]
        public int Codigo { get; set; }
        [JsonPropertyName("NOME")]
        public string? Nome { get; set; }
        [JsonPropertyName("EMAIL")]
        public string? Email { get; set; }
        [JsonPropertyName("TELEFONE1")]
        public string? Telefone1 { get; set; }
        [JsonPropertyName("TELEFONE2")]
        public string? Telefone2 { get; set; }
        [JsonPropertyName("CIDADE")]
        public string? Cidade { get; set; }
        [JsonPropertyName("ESTADO")]
        public string? Estado { get; set; }
        [JsonPropertyName("CEP")]
        public string? Cep { get; set; }
        [JsonPropertyName("RUA")]
        public string? Rua { get; set; }
        [JsonPropertyName("NUMERO")]
        public string? Numero { get; set; }
        [JsonPropertyName("BAIRRO")]
        public string? Bairro { get; set; }
        [JsonPropertyName("COMPLEMENTO")]
        public string? Complemento { get; set; }
        [JsonPropertyName("CPF")]
        public string? Cpf { get; set; }
        [JsonPropertyName("CARTIDENTIDADE")]
        public string? CartIdentidade { get; set; }
        [JsonPropertyName("DTNASCIMENTO")]
        public DateTime? DtNascimento { get; set; }
        [JsonPropertyName("OBSPESSOA")]
        public string? ObsPessoa { get; set; }
    }

    /// <summary>Resposta da API: origem vem como string (JsonStringEnumConverter).</summary>
    private sealed record PessoaResponse(Guid Id, string Nome, string Email, string? Fone, string? Cidade, string? Uf,
        string? LinkedinUrl, string? ResumoProfissional, string? Obs, string? Cep, string? Logradouro, string? Numero,
        string? Bairro, string? Complemento, string? Cpf, string? Rg, string? FoneContato, DateTime? DataNascimento,
        string? Origem, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);

    private sealed record PessoaListItemResponse(Guid Id, string Nome, string Email, string? Fone, string? Cidade, string? Uf,
        string? Origem, DateTimeOffset CreatedAtUtc, bool EstaBloqueado, Guid? BloqueioId);

    private sealed record PessoaPagedResponse(IReadOnlyList<PessoaListItemResponse> Items, int TotalCount, int Page, int PageSize);
}
