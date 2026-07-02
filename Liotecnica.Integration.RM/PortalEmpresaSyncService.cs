using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Sincroniza filiais TOTVS (<c>GFILIAL</c>) → Empresas no Portal (<c>POST /api/empresas</c>).
///
/// Cada GFILIAL ativa vira uma Empresa no Portal (Code = CODFILIAL formatado, Description = NOMEFILIAL).
/// Idempotente: se já existir Empresa com o mesmo Code, atualiza via PUT.
/// </summary>
public sealed class PortalEmpresaSyncService
{
    private readonly ILogger<PortalEmpresaSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public PortalEmpresaSyncService(
        ILogger<PortalEmpresaSyncService> logger,
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

    public async Task SyncEmpresasFromUnidadeJsonAsync(CancellationToken ct = default)
    {
        try { await SyncCoreAsync(ct); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Empresas: falha geral.");
            _logWriter.WriteLine($"Sync Empresas: falha geral - {ex.Message}");
        }
    }

    private async Task SyncCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var file = Path.Combine(path, "unidade.json");
        if (!File.Exists(file))
        {
            _logWriter.WriteLine("Sync Empresas: unidade.json não encontrado; pulando.");
            return;
        }

        var json = await File.ReadAllTextAsync(file, ct);
        var rows = JsonSerializer.Deserialize<List<GfilialRow>>(json, JsonOptions);
        if (rows is null || rows.Count == 0)
        {
            _logWriter.WriteLine("Sync Empresas: arquivo vazio.");
            return;
        }

        // Filtra ativas (ATIVO = 1) e dedupa por Code
        var ativas = rows
            .Where(r => (r.Ativo ?? 0) == 1 && r.CodFilial.HasValue && !string.IsNullOrWhiteSpace(r.NomeFantasia))
            .Select(r => new
            {
                Code = r.CodFilial!.Value.ToString().PadLeft(2, '0'),
                Description = (r.NomeFantasia ?? r.RazaoSocial ?? "").Trim(),
                Cep = r.Cep,
                Logradouro = r.Rua,
                Numero = r.Numero,
                Bairro = r.Bairro,
                Cidade = r.Cidade,
                Uf = r.Estado,
                IsActive = true,
            })
            .Where(x => !string.IsNullOrWhiteSpace(x.Description))
            .GroupBy(x => x.Code)
            .Select(g => g.First())
            .ToList();

        // Lê empresas existentes pra resolver create vs update
        var existing = await LoadExistingEmpresasAsync(ct);
        var created = 0;
        var updated = 0;

        foreach (var row in ativas)
        {
            var body = new
            {
                code = row.Code,
                description = Trunc(row.Description, 120),
                cep = Trunc(row.Cep, 20),
                logradouro = Trunc(row.Logradouro, 200),
                numero = Trunc(row.Numero, 40),
                bairro = Trunc(row.Bairro, 120),
                cidade = Trunc(row.Cidade, 120),
                uf = Trunc(row.Uf, 2),
                isActive = row.IsActive,
            };

            if (existing.TryGetValue(row.Code, out var id))
            {
                var resp = await _portalClient.Http.PutAsJsonAsync($"api/empresas/{id}", body, JsonOptions, ct);
                if (resp.IsSuccessStatusCode) updated++;
                else _logWriter.WriteLine($"Sync Empresas: ERRO PUT {resp.StatusCode} para Code={row.Code}");
            }
            else
            {
                var resp = await _portalClient.Http.PostAsJsonAsync("api/empresas", body, JsonOptions, ct);
                if (resp.IsSuccessStatusCode) created++;
                else
                {
                    var msg = await resp.Content.ReadAsStringAsync(ct);
                    _logWriter.WriteLine($"Sync Empresas: ERRO POST {resp.StatusCode} para Code={row.Code}: {msg}");
                }
            }
        }

        _logWriter.WriteLine($"Sync Empresas: concluído. Criadas: {created}, atualizadas: {updated}, total RM ativas: {ativas.Count}");
        _logger.LogInformation("Sync Empresas: criadas={Created}, atualizadas={Updated}, total={Total}", created, updated, ativas.Count);

        await GeocodificarPendentesAsync(ct);
    }

    /// <summary>
    /// Após importar/atualizar filiais do RM, geocodifica empresas sem coordenadas
    /// (rate limit Nominatim respeitado no endpoint da API).
    /// </summary>
    private async Task GeocodificarPendentesAsync(CancellationToken ct)
    {
        try
        {
            using var resp = await _portalClient.Http.PostAsync(
                "api/empresas/geocodificar-pendentes?take=200", null, ct);
            if (!resp.IsSuccessStatusCode)
            {
                _logWriter.WriteLine($"Sync Empresas: geocodificar-pendentes retornou {resp.StatusCode}");
                return;
            }

            var result = await resp.Content.ReadFromJsonAsync<GeocodificarPendentesResult>(JsonOptions, ct);
            if (result is null)
                return;

            _logWriter.WriteLine(
                $"Sync Empresas: geocodificação pendentes — total={result.Total}, ok={result.Geocodificadas}, falhas={result.Falhas}");
            _logger.LogInformation(
                "Sync Empresas geocodificar-pendentes: total={Total}, ok={Ok}, falhas={Falhas}",
                result.Total, result.Geocodificadas, result.Falhas);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Sync Empresas: falha ao geocodificar pendentes");
            _logWriter.WriteLine($"Sync Empresas: geocodificar-pendentes ERRO - {ex.Message}");
        }
    }

    private async Task<Dictionary<string, Guid>> LoadExistingEmpresasAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var list = await _portalClient.Http.GetFromJsonAsync<List<EmpresaItem>>("api/empresas?take=5000", JsonOptions, ct);
            if (list is not null)
                foreach (var e in list)
                    map[e.Code.Trim()] = e.Id;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao carregar empresas existentes; assumindo nenhuma.");
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

    private sealed class GfilialRow
    {
        [JsonPropertyName("CODFILIAL")]
        public int? CodFilial { get; set; }
        [JsonPropertyName("NOMEFANTASIA")]
        public string? NomeFantasia { get; set; }
        [JsonPropertyName("NOME")]
        public string? RazaoSocial { get; set; }
        [JsonPropertyName("CGC")]
        public string? Cnpj { get; set; }
        [JsonPropertyName("ATIVO")]
        public int? Ativo { get; set; }
        [JsonPropertyName("RUA")]
        public string? Rua { get; set; }
        [JsonPropertyName("NUMERO")]
        public string? Numero { get; set; }
        [JsonPropertyName("BAIRRO")]
        public string? Bairro { get; set; }
        [JsonPropertyName("CIDADE")]
        public string? Cidade { get; set; }
        [JsonPropertyName("ESTADO")]
        public string? Estado { get; set; }
        [JsonPropertyName("CEP")]
        public string? Cep { get; set; }
    }

    private sealed record EmpresaItem(Guid Id, string Code);

    private sealed record GeocodificarPendentesResult(int Total, int Geocodificadas, int Falhas);
}
