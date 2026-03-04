using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Envia o departamento do RM (PSECAO / departamento.json) para a nossa API como Área.
/// No nosso projeto, departamento (RM) = área (portal). Respeita a hierarquia pai/filho (CODIGO/CODIGOPAI).
/// </summary>
public sealed class PortalAreaSyncService
{
    private readonly ILogger<PortalAreaSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public PortalAreaSyncService(
        ILogger<PortalAreaSyncService> logger,
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
    /// Lê departamento.json (PSECAO), ordena por hierarquia (pai antes de filho) e envia para api/areas.
    /// Departamento (RM) = Área no nosso portal. Não propaga exceções para o worker continuar rodando.
    /// </summary>
    public async Task SyncAreasFromDepartamentoJsonAsync(CancellationToken ct = default)
    {
        try
        {
            await SyncAreasFromDepartamentoJsonCoreAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Áreas: falha geral.");
            _logWriter.WriteLine($"Sync Áreas: falha geral - {ex.Message}");
        }
    }

    private async Task SyncAreasFromDepartamentoJsonCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var file = Path.Combine(path, "departamento.json");
        if (!File.Exists(file))
        {
            _logWriter.WriteLine("Sync Áreas: arquivo departamento.json não encontrado; pulando envio.");
            _logger.LogWarning("Arquivo {File} não encontrado; pulando sync de áreas.", file);
            return;
        }

        var json = await File.ReadAllTextAsync(file, ct);
        var items = JsonSerializer.Deserialize<List<DepartamentoRow>>(json, JsonOptions);
        if (items is null || items.Count == 0)
        {
            _logWriter.WriteLine("Sync Áreas: nenhum registro em departamento.json.");
            return;
        }

        var ordered = OrderByHierarchy(items);
        _logWriter.WriteLine($"Sync Áreas: enviando {ordered.Count} itens (pai -> filho) para api/areas");

        var codeToId = await LoadExistingAreasAsync(ct);

        var created = 0;
        var updated = 0;
        var skipped = 0;
        foreach (var row in ordered)
        {
            try
            {
                var code = NormalizeCode(row.Codigo);
                var parentCode = NormalizeCode(row.CodigoPai);
                if (string.IsNullOrEmpty(code)) continue;

                Guid? parentId = null;
                if (!string.IsNullOrEmpty(parentCode) && codeToId.TryGetValue(parentCode, out var pid))
                    parentId = pid;

                var name = (row.Descricao ?? code).Trim();
                if (name.Length > 120) name = name.Substring(0, 120);

                var body = new AreaCreateRequest(
                    Code: code.Length > 40 ? code.Substring(0, 40) : code,
                    Name: name,
                    Description: null,
                    IsActive: true,
                    ParentId: parentId,
                    OwnerFuncionarioId: null
                );

                if (codeToId.TryGetValue(code, out var existingId))
                {
                    var response = await _portalClient.Http.PutAsJsonAsync($"api/areas/{existingId}", body, JsonOptions, ct);
                    if (response.IsSuccessStatusCode)
                        updated++;
                    else
                    {
                        var msg = await response.Content.ReadAsStringAsync(ct);
                        _logWriter.WriteLine($"Sync Áreas: ERRO PUT {response.StatusCode} para Code={code}: {msg}");
                        _logger.LogWarning("PUT api/areas/{Id} falhou para Code={Code}: {Status} {Msg}", existingId, code, response.StatusCode, msg);
                    }
                    continue;
                }

                var postResponse = await _portalClient.Http.PostAsJsonAsync("api/areas", body, JsonOptions, ct);
                if (postResponse.IsSuccessStatusCode)
                {
                    var area = await postResponse.Content.ReadFromJsonAsync<AreaResponse>(JsonOptions, ct);
                    if (area != null && !string.IsNullOrEmpty(code))
                    {
                        codeToId[code] = area.Id;
                        created++;
                    }
                }
                else
                {
                    var msg = await postResponse.Content.ReadAsStringAsync(ct);
                    _logWriter.WriteLine($"Sync Áreas: ERRO {postResponse.StatusCode} para Code={code}: {msg}");
                    _logger.LogWarning("POST api/areas falhou para Code={Code}: {Status} {Msg}", code, postResponse.StatusCode, msg);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao enviar área Code={Code}; continuando.", row.Codigo);
                _logWriter.WriteLine($"Sync Áreas: exceção para Code={row.Codigo}: {ex.Message}");
            }
        }

        _logWriter.WriteLine($"Sync Áreas: concluído. Criadas: {created}, atualizadas: {updated}, já existentes: {skipped}");
        _logger.LogInformation("Sync Áreas: criadas={Created}, atualizadas={Updated}, já existentes={Skipped}", created, updated, skipped);
    }

    private async Task<Dictionary<string, Guid>> LoadExistingAreasAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var list = await _portalClient.Http.GetFromJsonAsync<List<AreaResponse>>("api/areas", JsonOptions, ct);
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
            _logger.LogWarning(ex, "Falha ao carregar áreas existentes do portal; assumindo nenhuma.");
            _logWriter.WriteLine($"Sync Áreas: falha ao carregar áreas existentes - {ex.Message}");
        }
        return map;
    }

    private static List<DepartamentoRow> OrderByHierarchy(List<DepartamentoRow> items)
    {
        return items
            .OrderBy(x => (NormalizeCode(x.Codigo) ?? "").Length)
            .ThenBy(x => NormalizeCode(x.Codigo) ?? "")
            .ToList();
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

    private sealed class DepartamentoRow
    {
        public string? Codigo { get; set; }
        public string? CodigoPai { get; set; }
        public string? Descricao { get; set; }
    }

    private sealed record AreaCreateRequest(
        string Code,
        string Name,
        string? Description,
        bool IsActive,
        Guid? ParentId,
        Guid? OwnerFuncionarioId
    );

    private sealed record AreaResponse(
        Guid Id,
        string Code,
        string Name,
        string? Description,
        bool IsActive,
        Guid? ParentId,
        Guid? OwnerFuncionarioId
    );
}
