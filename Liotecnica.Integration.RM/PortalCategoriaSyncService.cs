using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Envia Cargo/Função do RM (PFUNCAO / cargo.json) para o portal como Função (api/requisito-categorias).
/// Cargo e Função no portal têm o mesmo nome (Função) e são sincronizados a partir do RM.
/// </summary>
public sealed class PortalCategoriaSyncService
{
    private readonly ILogger<PortalCategoriaSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public PortalCategoriaSyncService(
        ILogger<PortalCategoriaSyncService> logger,
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
    /// Lê funcao.json (PFUNCAO do RM) e envia para api/requisito-categorias (Funções no portal).
    /// Não propaga exceções para o worker continuar rodando.
    /// </summary>
    public async Task SyncCategoriasFromCargoJsonAsync(CancellationToken ct = default)
    {
        try
        {
            await SyncCategoriasFromCargoJsonCoreAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Funções: falha geral.");
            _logWriter.WriteLine($"Sync Funções: falha geral - {ex.Message}");
        }
    }

    private async Task SyncCategoriasFromCargoJsonCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var file = Path.Combine(path, "funcao.json");
        if (!File.Exists(file))
        {
            _logWriter.WriteLine("Sync Funções: arquivo funcao.json não encontrado; pulando envio.");
            _logger.LogWarning("Arquivo {File} não encontrado; pulando sync de funções.", file);
            return;
        }

        var json = await File.ReadAllTextAsync(file, ct);
        var items = JsonSerializer.Deserialize<List<FuncaoRow>>(json, JsonOptions);
        if (items is null || items.Count == 0)
        {
            _logWriter.WriteLine("Sync Funções: nenhum registro em funcao.json.");
            return;
        }

        _logWriter.WriteLine($"Sync Funções: enviando {items.Count} itens (PFUNCAO -> Funções) para api/requisito-categorias");

        var codeToId = await LoadExistingCategoriasAsync(ct);

        var created = 0;
        var updated = 0;
        var skipped = 0;
        foreach (var row in items)
        {
            try
            {
                var code = NormalizeCode(row.Codigo);
                if (string.IsNullOrEmpty(code)) continue;

                var name = (row.Nome ?? code).Trim();
                if (name.Length > 120) name = name.Substring(0, 120);
                var description = string.IsNullOrWhiteSpace(row.Descricao) ? null : row.Descricao.Trim();
                if (description != null && description.Length > 1000) description = description.Substring(0, 1000);
                // PFUNCAO usa INATIVA (0=ativo, 1=inativo)
                var isActive = row.Inativa != 1;

                var body = new RequisitoCategoriaCreateRequest(
                    Code: code.Length > 40 ? code.Substring(0, 40) : code,
                    Name: name,
                    Description: description,
                    IsActive: isActive
                );

                if (codeToId.TryGetValue(code, out var existingId))
                {
                    var response = await _portalClient.Http.PutAsJsonAsync($"api/requisito-categorias/{existingId}", body, JsonOptions, ct);
                    if (response.IsSuccessStatusCode)
                        updated++;
                    else
                    {
                        var msg = await response.Content.ReadAsStringAsync(ct);
                        _logWriter.WriteLine($"Sync Funções: ERRO PUT {response.StatusCode} para Code={code}: {msg}");
                        _logger.LogWarning("PUT api/requisito-categorias/{Id} falhou para Code={Code}: {Status} {Msg}", existingId, code, response.StatusCode, msg);
                    }
                    continue;
                }

                var postResponse = await _portalClient.Http.PostAsJsonAsync("api/requisito-categorias", body, JsonOptions, ct);
                if (postResponse.IsSuccessStatusCode)
                {
                    var cat = await postResponse.Content.ReadFromJsonAsync<RequisitoCategoriaResponse>(JsonOptions, ct);
                    if (cat != null && !string.IsNullOrEmpty(code))
                    {
                        codeToId[code] = cat.Id;
                        created++;
                    }
                }
                else
                {
                    var msg = await postResponse.Content.ReadAsStringAsync(ct);
                    _logWriter.WriteLine($"Sync Funções: ERRO {postResponse.StatusCode} para Code={code}: {msg}");
                    _logger.LogWarning("POST api/requisito-categorias falhou para Code={Code}: {Status} {Msg}", code, postResponse.StatusCode, msg);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao enviar função Code={Code}; continuando.", row.Codigo ?? "");
                _logWriter.WriteLine($"Sync Funções: exceção para Code={row.Codigo}: {ex.Message}");
            }
        }

        _logWriter.WriteLine($"Sync Funções: concluído. Criadas: {created}, atualizadas: {updated}, já existentes: {skipped}");
        _logger.LogInformation("Sync Funções: criadas={Created}, atualizadas: {Updated}, já existentes: {Skipped}", created, updated, skipped);
    }

    private async Task<Dictionary<string, Guid>> LoadExistingCategoriasAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var list = await _portalClient.Http.GetFromJsonAsync<List<RequisitoCategoriaResponse>>("api/requisito-categorias", JsonOptions, ct);
            if (list != null)
                foreach (var a in list)
                {
                    var key = NormalizeCode(a.Code);
                    if (!string.IsNullOrEmpty(key))
                        map[key] = a.Id;
                }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao carregar funções existentes do portal; assumindo nenhuma.");
            _logWriter.WriteLine($"Sync Funções: falha ao carregar funções existentes - {ex.Message}");
        }
        return map;
    }

    private static string? NormalizeCode(string? code) => string.IsNullOrWhiteSpace(code) ? null : code.Trim();

    private string GetSchemaTablesPath()
    {
        var path = _outputOptions.SchemaTablesPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            return Path.IsPathRooted(path) ? path : Path.GetFullPath(path);
        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }

    /// <summary>Linha de funcao.json (PFUNCAO).</summary>
    private sealed class FuncaoRow
    {
        public string? Codigo { get; set; }
        public string? Nome { get; set; }
        public string? Descricao { get; set; }
        public int Inativa { get; set; }
    }

    private sealed record RequisitoCategoriaCreateRequest(string Code, string Name, string? Description, bool IsActive);

    private sealed record RequisitoCategoriaResponse(Guid Id, string Code, string Name, string? Description, bool IsActive);
}
