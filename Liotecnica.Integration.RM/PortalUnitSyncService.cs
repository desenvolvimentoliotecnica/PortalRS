using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Envia unidades/estabelecimentos do RM para a API do Portal como Unit (api/units).
/// Suporta: GFILIAL (estabelecimentos/filiais – recomendado) ou LUNIDADE (unidade.json).
/// </summary>
public sealed class PortalUnitSyncService
{
    private readonly ILogger<PortalUnitSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public PortalUnitSyncService(
        ILogger<PortalUnitSyncService> logger,
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
    /// Lê unidade.json (GFILIAL = estabelecimentos ou LUNIDADE) e envia para api/units. Não propaga exceções.
    /// </summary>
    public async Task SyncUnitsFromUnidadeJsonAsync(CancellationToken ct = default)
    {
        try
        {
            await SyncUnitsFromUnidadeJsonCoreAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Unidades: falha geral.");
            _logWriter.WriteLine($"Sync Unidades: falha geral - {ex.Message}");
        }
    }

    private async Task SyncUnitsFromUnidadeJsonCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var file = Path.Combine(path, "unidade.json");
        if (!File.Exists(file))
        {
            _logWriter.WriteLine("Sync Unidades: arquivo unidade.json não encontrado; pulando envio.");
            _logger.LogWarning("Arquivo {File} não encontrado; pulando sync de unidades.", file);
            return;
        }

        var json = await File.ReadAllTextAsync(file, ct);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (root.ValueKind != JsonValueKind.Array)
        {
            _logWriter.WriteLine("Sync Unidades: unidade.json não é um array; pulando.");
            return;
        }

        var items = new List<JsonElement>();
        foreach (var e in root.EnumerateArray())
            items.Add(e);

        if (items.Count == 0)
        {
            _logWriter.WriteLine("Sync Unidades: nenhum registro em unidade.json.");
            return;
        }

        var isGfilial = items[0].TryGetProperty("CODFILIAL", out _);
        _logWriter.WriteLine($"Sync Unidades: enviando {items.Count} itens ({ (isGfilial ? "GFILIAL" : "LUNIDADE") } -> api/units)");

        var codeToId = await LoadExistingUnitsAsync(ct);

        var created = 0;
        var skipped = 0;
        foreach (var row in items)
        {
            try
            {
                UnitCreateRequest body;
                if (row.TryGetProperty("CODFILIAL", out _))
                    body = MapGfilialToUnit(row);
                else
                    body = MapLunidadeToUnit(row);

                if (body == null)
                    continue;

                var code = NormalizeCode(body.Code);
                if (string.IsNullOrEmpty(code)) continue;

                if (codeToId.TryGetValue(code, out _))
                {
                    skipped++;
                    continue;
                }

                var response = await _portalClient.Http.PostAsJsonAsync("api/units", body, JsonOptions, ct);
                if (response.IsSuccessStatusCode)
                {
                    var unit = await response.Content.ReadFromJsonAsync<UnitResponse>(JsonOptions, ct);
                    if (unit != null && !string.IsNullOrEmpty(unit.Code))
                    {
                        codeToId[unit.Code] = unit.Id;
                        created++;
                    }
                }
                else
                {
                    var msg = await response.Content.ReadAsStringAsync(ct);
                    _logWriter.WriteLine($"Sync Unidades: ERRO {response.StatusCode} para Code={code}: {msg}");
                    _logger.LogWarning("POST api/units falhou para Code={Code}: {Status} {Msg}", code, response.StatusCode, msg);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao enviar unidade; continuando.");
                _logWriter.WriteLine($"Sync Unidades: exceção: {ex.Message}");
            }
        }

        _logWriter.WriteLine($"Sync Unidades: concluído. Criadas: {created}, já existentes: {skipped}");
        _logger.LogInformation("Sync Unidades: criadas={Created}, já existentes: {Skipped}", created, skipped);
    }

    private async Task<Dictionary<string, Guid>> LoadExistingUnitsAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var page = 1;
            const int pageSize = 500;
            while (true)
            {
                var paged = await _portalClient.Http.GetFromJsonAsync<PagedResult<UnitGridRowResponse>>(
                    $"api/units?page={page}&pageSize={pageSize}", JsonOptions, ct);
                if (paged?.Items == null || paged.Items.Count == 0)
                    break;
                foreach (var u in paged.Items)
                {
                    var key = NormalizeCode(u.Code);
                    if (!string.IsNullOrEmpty(key))
                        map[key] = u.Id;
                }
                if (page >= (paged.TotalPages ?? 1))
                    break;
                page++;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao carregar unidades existentes do portal; assumindo nenhuma.");
            _logWriter.WriteLine($"Sync Unidades: falha ao carregar existentes - {ex.Message}");
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

    /// <summary>Mapeia linha GFILIAL (estabelecimentos) para Unit do Portal.</summary>
    private static UnitCreateRequest? MapGfilialToUnit(JsonElement row)
    {
        var codeRaw = row.TryGetProperty("CODFILIAL", out var c) ? c : default;
        var code = (codeRaw.ValueKind == JsonValueKind.Number ? codeRaw.ToString() : codeRaw.GetString())?.Trim();
        var name = (row.TryGetProperty("NOME", out var n) ? n.GetString() : null)
            ?? (row.TryGetProperty("NOMEFANTASIA", out var nf) ? nf.GetString() : null)
            ?? code;
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name))
            return null;
        if (code.Length > 40) code = code.Substring(0, 40);
        if (name.Length > 140) name = name.Substring(0, 140);

        var rua = row.TryGetProperty("RUA", out var r) ? r.GetString()?.Trim() : null;
        var numero = row.TryGetProperty("NUMERO", out var num) ? num.GetString()?.Trim() : null;
        var addressLine = string.IsNullOrEmpty(rua) ? null : (string.IsNullOrEmpty(numero) ? rua : $"{rua}, {numero}");

        return new UnitCreateRequest(
            Code: code,
            Name: name,
            Status: 1,
            City: row.TryGetProperty("CIDADE", out var ci) ? ci.GetString()?.Trim() : null,
            Uf: row.TryGetProperty("ESTADO", out var uf) ? uf.GetString()?.Trim() : null,
            AddressLine: addressLine,
            Neighborhood: row.TryGetProperty("BAIRRO", out var b) ? b.GetString()?.Trim() : null,
            ZipCode: row.TryGetProperty("CEP", out var z) ? z.GetString()?.Trim() : null,
            Email: row.TryGetProperty("EMAIL", out var e) ? e.GetString()?.Trim() : null,
            Phone: row.TryGetProperty("TELEFONE", out var p) ? p.GetString()?.Trim() : null,
            ResponsibleName: row.TryGetProperty("CONTATO", out var cont) ? cont.GetString()?.Trim() : null,
            Type: null,
            Headcount: 0,
            Notes: null
        );
    }

    /// <summary>Mapeia linha LUNIDADE para Unit do Portal.</summary>
    private static UnitCreateRequest? MapLunidadeToUnit(JsonElement row)
    {
        var codeRaw = row.TryGetProperty("CODIGO", out var c) ? c : default;
        var code = (codeRaw.ValueKind == JsonValueKind.Number ? codeRaw.ToString() : codeRaw.GetString())?.Trim();
        var name = row.TryGetProperty("UNIDADE", out var u) ? u.GetString()?.Trim() : null ?? code;
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name))
            return null;
        if (code.Length > 40) code = code.Substring(0, 40);
        if (name.Length > 140) name = name.Substring(0, 140);

        return new UnitCreateRequest(
            Code: code,
            Name: name,
            Status: 1,
            City: null,
            Uf: null,
            AddressLine: null,
            Neighborhood: null,
            ZipCode: null,
            Email: null,
            Phone: null,
            ResponsibleName: null,
            Type: null,
            Headcount: 0,
            Notes: null
        );
    }

    private sealed record UnitCreateRequest(
        string Code,
        string Name,
        int Status,
        string? City,
        string? Uf,
        string? AddressLine,
        string? Neighborhood,
        string? ZipCode,
        string? Email,
        string? Phone,
        string? ResponsibleName,
        string? Type,
        int Headcount,
        string? Notes
    );

    private sealed record UnitResponse(Guid Id, string Code, string Name, int Status, string? City, string? Uf,
        string? AddressLine, string? Neighborhood, string? ZipCode, string? Email, string? Phone,
        string? ResponsibleName, string? Type, int Headcount, string? Notes, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);

    private sealed record UnitGridRowResponse(Guid Id, string Name, string Code, int Status, int Headcount,
        string? Email, string? Phone, string? Type, string? City, string? Uf, string? AddressLine,
        string? Neighborhood, string? ZipCode, string? ResponsibleName, string? Notes);

    private sealed record PagedResult<T>(List<T> Items, int Page, int PageSize, int TotalItems, int? TotalPages);
}
