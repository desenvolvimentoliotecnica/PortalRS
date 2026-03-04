using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Envia o Funcionário do RM (SEMPRESAFUNCIONARIO / funcionario.json) para a API do Portal como Funcionario (api/funcionarios).
/// SEMPRESAFUNCIONARIO tem NOME, EMAIL, CHAPA, CARGO, ATIVO (ativo/desligado).
/// Se o RM disponibilizar códigos como CODFILIAL/CODSECAO na extração, o sync tenta resolver UnitId/AreaId via Code já cadastrado no Portal (api/units, api/areas).
/// </summary>
public sealed class PortalFuncionarioSyncService
{
    private readonly ILogger<PortalFuncionarioSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public PortalFuncionarioSyncService(
        ILogger<PortalFuncionarioSyncService> logger,
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
    /// Lê funcionario.json (SEMPRESAFUNCIONARIO) e envia para api/funcionarios. Não propaga exceções.
    /// </summary>
    public async Task SyncFuncionariosFromFuncionarioJsonAsync(CancellationToken ct = default)
    {
        try
        {
            await SyncFuncionariosFromFuncionarioJsonCoreAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Funcionários: falha geral.");
            _logWriter.WriteLine($"Sync Funcionários: falha geral - {ex.Message}");
        }
    }

    private async Task SyncFuncionariosFromFuncionarioJsonCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var funcionarioFile = Path.Combine(path, "funcionario.json");
        if (File.Exists(funcionarioFile))
        {
            var json = await File.ReadAllTextAsync(funcionarioFile, ct);
            var items = JsonSerializer.Deserialize<List<FuncionarioRow>>(json, JsonOptions);
            if (items is not null && items.Count > 0)
            {
                var codeToRequisitoCategoriaId = await LoadRequisitoCategoriasByCodeAsync(ct);
                var codeToUnitId = await LoadUnitsByCodeAsync(ct);
                var codeToAreaId = await LoadAreasByCodeAsync(ct);

                await SyncFuncionariosFromRowsAsync(items, (row) =>
                {
                    var chapa = (row.Chapa ?? "").Trim();
                    var name = (row.Nome ?? "").Trim();
                    var email = (row.Email ?? "").Trim();
                    if (string.IsNullOrEmpty(email)) email = string.IsNullOrEmpty(chapa) ? null : $"{chapa}@rm.sync";
                    if (string.IsNullOrEmpty(email)) return (null, null, null, null, null, null, null, null);
                    if (string.IsNullOrEmpty(name)) name = chapa ?? email;
                    var statusStr = IsAtivo(row.Ativo) ? "Active" : "Inactive";
                    var notes = string.IsNullOrEmpty(chapa) ? null : $"RM CHAPA={chapa}";
                    var funcaoCode = (row.Funcao ?? "").Trim();
                    var requisitoCategoriaId = string.IsNullOrEmpty(funcaoCode) ? null : (codeToRequisitoCategoriaId.TryGetValue(funcaoCode, out var id) ? id : (Guid?)null);

                    var unitCode = NormalizeCode(GetFirstNonEmpty(
                        GetAsCode(row.CodFilial),
                        GetAsCode(row.CodFilialAlt),
                        GetAsCode(row.CodEstabelecimento),
                        GetAsCode(row.CodUnidade)));
                    var areaCode = NormalizeCode(GetFirstNonEmpty(
                        GetAsCode(row.CodSecao),
                        GetAsCode(row.CodSecaoAlt),
                        GetAsCode(row.CodDepartamento),
                        GetAsCode(row.CodDepto)));

                    Guid? unitId = null;
                    if (!string.IsNullOrEmpty(unitCode) && codeToUnitId.TryGetValue(unitCode, out var uid))
                        unitId = uid;

                    Guid? areaId = null;
                    if (!string.IsNullOrEmpty(areaCode) && codeToAreaId.TryGetValue(areaCode, out var aid))
                        areaId = aid;

                    return (name, email, Trunc(row.Telefone, 40), statusStr, notes, requisitoCategoriaId, unitId, areaId);
                }, "SEMPRESAFUNCIONARIO", ct);
                return;
            }
        }

        _logWriter.WriteLine("Sync Funcionários: funcionario.json vazio ou ausente; sincronizando a partir de pessoa.json (PPESSOA).");
        _logger.LogInformation("Funcionário: sincronizando a partir de pessoa.json (PPESSOA).");
        var pessoaFile = Path.Combine(path, "pessoa.json");
        if (!File.Exists(pessoaFile))
        {
            _logWriter.WriteLine("Sync Funcionários: pessoa.json não encontrado; pulando.");
            return;
        }
        var pessoaJson = await File.ReadAllTextAsync(pessoaFile, ct);
        var pessoas = JsonSerializer.Deserialize<List<PessoaRowForFuncionario>>(pessoaJson, JsonOptions);
        if (pessoas is null || pessoas.Count == 0)
        {
            _logWriter.WriteLine("Sync Funcionários: nenhum registro em pessoa.json.");
            return;
        }
        await SyncFuncionariosFromPessoaRowsAsync(pessoas, ct);
    }

    /// <summary>Sync a partir de linhas de pessoa.json (PPESSOA): um Funcionário por Pessoa.</summary>
    private async Task SyncFuncionariosFromPessoaRowsAsync(List<PessoaRowForFuncionario> rows, CancellationToken ct)
    {
        var emailToExisting = await LoadExistingFuncionariosAsync(ct);
        var attemptedThisBatch = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var created = 0;
        var skipped = 0;
        var updated = 0;
        _logWriter.WriteLine($"Sync Funcionários (de Pessoas): enviando até {rows.Count} itens (PPESSOA -> api/funcionarios)");

        foreach (var row in rows)
        {
            try
            {
                var nome = (row.Nome ?? "").Trim();
                if (string.IsNullOrEmpty(nome)) continue;
                var email = (row.Email ?? "").Trim();
                if (string.IsNullOrEmpty(email))
                    email = $"codigo{row.Codigo}@rm.sync";
                var key = email.Trim().ToLowerInvariant();
                if (string.IsNullOrEmpty(key)) continue;
                if (emailToExisting.TryGetValue(key, out _)) { skipped++; continue; }
                if (attemptedThisBatch.Contains(key)) { skipped++; continue; }
                attemptedThisBatch.Add(key);

                var body = new
                {
                    name = nome.Length > 160 ? nome.Substring(0, 160) : nome,
                    email = email.Length > 180 ? email.Substring(0, 180) : email,
                    phone = Trunc(row.Telefone1, 40),
                    status = "Active",
                    headcount = 1,
                    unitId = (Guid?)null,
                    areaId = (Guid?)null,
                    jobPositionId = (Guid?)null,
                    requisitoCategoriaId = (Guid?)null,
                    notes = $"RM CODIGO={row.Codigo}",
                    userId = (Guid?)null
                };

                var response = await _portalClient.Http.PostAsJsonAsync("api/funcionarios", body, JsonOptions, ct);
                if (response.IsSuccessStatusCode)
                {
                    var f = await response.Content.ReadFromJsonAsync<FuncionarioResponse>(JsonOptions, ct);
                    if (f != null && !string.IsNullOrEmpty(f.Email))
                    {
                        emailToExisting[f.Email.Trim().ToLowerInvariant()] = new ExistingFuncionario(f.Id, null, null);
                        created++;
                    }
                }
                else
                {
                    var msg = await response.Content.ReadAsStringAsync(ct);
                    _logWriter.WriteLine($"Sync Funcionários (Pessoas): ERRO {response.StatusCode} para Email={email}: {msg}");
                    _logger.LogWarning("POST api/funcionarios falhou para Email={Email}: {Status} {Msg}", email, response.StatusCode, msg);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao enviar funcionário Codigo={Codigo}; continuando.", row.Codigo);
                _logWriter.WriteLine($"Sync Funcionários (Pessoas): exceção para Codigo={row.Codigo}: {ex.Message}");
            }
        }

        _logWriter.WriteLine($"Sync Funcionários (de Pessoas): concluído. Criados: {created}, atualizados: {updated}, já existentes: {skipped}");
        _logger.LogInformation("Sync Funcionários (de Pessoas): criados={Created}, atualizados={Updated}, já existentes: {Skipped}", created, updated, skipped);
    }

    private async Task<Dictionary<string, Guid>> LoadRequisitoCategoriasByCodeAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var list = await _portalClient.Http.GetFromJsonAsync<List<RequisitoCategoriaItem>>("api/requisito-categorias", JsonOptions, ct);
            if (list != null)
                foreach (var x in list)
                {
                    var code = (x.Code ?? "").Trim();
                    if (!string.IsNullOrEmpty(code))
                        map[code] = x.Id;
                }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao carregar funções (requisito-categorias); funcionário sem função.");
        }
        return map;
    }

    private async Task SyncFuncionariosFromRowsAsync<T>(
        List<T> items,
        Func<T, (string? name, string? email, string? phone, string? statusStr, string? notes, Guid? requisitoCategoriaId, Guid? unitId, Guid? areaId)> mapRow,
        string sourceName,
        CancellationToken ct)
    {
        _logWriter.WriteLine($"Sync Funcionários: enviando {items.Count} itens ({sourceName} -> api/funcionarios)");
        var emailToExisting = await LoadExistingFuncionariosAsync(ct);
        var created = 0;
        var skipped = 0;
        var updated = 0;
        foreach (var row in items)
        {
            try
            {
                var (name, email, phone, statusStr, notes, requisitoCategoriaId, unitId, areaId) = mapRow(row);
                if (string.IsNullOrEmpty(email)) continue;
                var key = email.Trim().ToLowerInvariant();
                if (emailToExisting.TryGetValue(key, out var existing))
                {
                    // Sempre atualiza existente com payload completo do RM (preenche vazios e alinha status).
                    var updateBody = new
                    {
                        name = (name ?? email).Length > 160 ? (name ?? email).Substring(0, 160) : (name ?? email),
                        email = email.Length > 180 ? email.Substring(0, 180) : email,
                        phone = phone,
                        status = statusStr ?? "Active",
                        headcount = 1,
                        unitId = unitId ?? existing.UnitId,
                        areaId = areaId ?? existing.AreaId,
                        jobPositionId = (Guid?)null,
                        requisitoCategoriaId = requisitoCategoriaId,
                        notes = notes
                    };

                    var resp = await _portalClient.Http.PutAsJsonAsync($"api/funcionarios/{existing.Id}", updateBody, JsonOptions, ct);
                    if (resp.IsSuccessStatusCode)
                    {
                        emailToExisting[key] = existing with { UnitId = updateBody.unitId, AreaId = updateBody.areaId };
                        updated++;
                    }
                    else
                    {
                        var msg = await resp.Content.ReadAsStringAsync(ct);
                        _logWriter.WriteLine($"Sync Funcionários: ERRO {resp.StatusCode} no UPDATE para Email={email}: {msg}");
                        _logger.LogWarning("PUT api/funcionarios/{Id} falhou para Email={Email}: {Status} {Msg}", existing.Id, email, resp.StatusCode, msg);
                    }
                    continue;
                }

                var body = new
                {
                    name = (name ?? email).Length > 160 ? (name ?? email).Substring(0, 160) : (name ?? email),
                    email = email.Length > 180 ? email.Substring(0, 180) : email,
                    phone = phone,
                    status = statusStr ?? "Active",
                    headcount = 1,
                    unitId = unitId,
                    areaId = areaId,
                    jobPositionId = (Guid?)null,
                    requisitoCategoriaId = requisitoCategoriaId,
                    notes = notes,
                    userId = (Guid?)null
                };
                var response = await _portalClient.Http.PostAsJsonAsync("api/funcionarios", body, JsonOptions, ct);
                if (response.IsSuccessStatusCode)
                {
                    var f = await response.Content.ReadFromJsonAsync<FuncionarioResponse>(JsonOptions, ct);
                    if (f != null && !string.IsNullOrEmpty(f.Email))
                    {
                        emailToExisting[f.Email.Trim().ToLowerInvariant()] = new ExistingFuncionario(f.Id, f.UnitId, f.AreaId);
                        created++;
                    }
                }
                else
                {
                    var msg = await response.Content.ReadAsStringAsync(ct);
                    _logWriter.WriteLine($"Sync Funcionários: ERRO {response.StatusCode} para Email={email}: {msg}");
                    _logger.LogWarning("POST api/funcionarios falhou para Email={Email}: {Status} {Msg}", email, response.StatusCode, msg);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao enviar funcionário; continuando.");
            }
        }
        _logWriter.WriteLine($"Sync Funcionários: concluído. Criados: {created}, atualizados: {updated}, já existentes: {skipped}");
        _logger.LogInformation("Sync Funcionários: criados={Created}, atualizados={Updated}, já existentes: {Skipped}", created, updated, skipped);
    }

    private async Task<Dictionary<string, ExistingFuncionario>> LoadExistingFuncionariosAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, ExistingFuncionario>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var page = 1;
            const int pageSize = 500;
            while (true)
            {
                var paged = await _portalClient.Http.GetFromJsonAsync<PagedResult<FuncionarioGridRowResponse>>(
                    $"api/funcionarios?page={page}&pageSize={pageSize}", JsonOptions, ct);
                if (paged?.Items == null || paged.Items.Count == 0)
                    break;
                foreach (var f in paged.Items)
                {
                    var key = (f.Email ?? "").Trim().ToLowerInvariant();
                    if (!string.IsNullOrEmpty(key))
                        map[key] = new ExistingFuncionario(f.Id, f.UnitId, f.AreaId);
                }
                if (page >= (paged.TotalPages ?? 1))
                    break;
                page++;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao carregar funcionários existentes do portal; assumindo nenhum.");
            _logWriter.WriteLine($"Sync Funcionários: falha ao carregar existentes - {ex.Message}");
        }
        return map;
    }

    private async Task<Dictionary<string, Guid>> LoadUnitsByCodeAsync(CancellationToken ct)
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
                    var code = NormalizeCode(u.Code);
                    if (!string.IsNullOrEmpty(code))
                        map[code] = u.Id;
                }
                if (page >= (paged.TotalPages ?? 1))
                    break;
                page++;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao carregar units do portal; funcionário ficará sem UnitId quando não resolver.");
            _logWriter.WriteLine($"Sync Funcionários: falha ao carregar units - {ex.Message}");
        }
        return map;
    }

    private async Task<Dictionary<string, Guid>> LoadAreasByCodeAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var list = await _portalClient.Http.GetFromJsonAsync<List<AreaItem>>("api/areas", JsonOptions, ct);
            if (list != null)
                foreach (var a in list)
                {
                    var code = NormalizeCode(a.Code);
                    if (!string.IsNullOrEmpty(code))
                        map[code] = a.Id;
                }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao carregar áreas do portal; funcionário ficará sem AreaId quando não resolver.");
            _logWriter.WriteLine($"Sync Funcionários: falha ao carregar áreas - {ex.Message}");
        }
        return map;
    }

    private string GetSchemaTablesPath()
    {
        var path = _outputOptions.SchemaTablesPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            return Path.IsPathRooted(path) ? path : Path.GetFullPath(path);
        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }

    /// <summary>ATIVO: 'S', '1', 'Y', 's', 'y' = ativo; caso contrário = desligado/inativo.</summary>
    private static bool IsAtivo(string? ativo)
    {
        if (string.IsNullOrWhiteSpace(ativo)) return true;
        var v = ativo.Trim();
        return v == "S" || v == "1" || v == "Y" || v.Equals("s", StringComparison.OrdinalIgnoreCase) || v.Equals("y", StringComparison.OrdinalIgnoreCase);
    }

    private static string? Trunc(string? value, int max) => string.IsNullOrEmpty(value) ? null : (value.Length <= max ? value : value.Substring(0, max));

    /// <summary>Linha de funcionario.json (SEMPRESAFUNCIONARIO do RM – colunas originais).</summary>
    private sealed class FuncionarioRow
    {
        [JsonPropertyName("CHAPA")]
        public string? Chapa { get; set; }
        [JsonPropertyName("NOME")]
        public string? Nome { get; set; }
        [JsonPropertyName("EMAIL")]
        public string? Email { get; set; }
        [JsonPropertyName("TELEFONE")]
        public string? Telefone { get; set; }
        [JsonPropertyName("CARGO")]
        public string? Cargo { get; set; }
        [JsonPropertyName("FUNCAO")]
        public string? Funcao { get; set; }
        [JsonPropertyName("ATIVO")]
        public string? Ativo { get; set; }
        [JsonPropertyName("CODPESSOA")]
        public int? Codpessoa { get; set; }

        // Campos opcionais (dependem do schema real do SEMPRESAFUNCIONARIO).
        // Se existirem na extração, usamos para resolver Unit/Area por código.
        [JsonPropertyName("CODFILIAL")]
        public JsonElement CodFilial { get; set; }
        [JsonPropertyName("CODFILIALFUNCIONARIO")]
        public JsonElement CodFilialAlt { get; set; }
        [JsonPropertyName("CODESTAB")]
        public JsonElement CodEstabelecimento { get; set; }
        [JsonPropertyName("CODUNIDADE")]
        public JsonElement CodUnidade { get; set; }

        [JsonPropertyName("CODSECAO")]
        public JsonElement CodSecao { get; set; }
        [JsonPropertyName("CODIGOSECAO")]
        public JsonElement CodSecaoAlt { get; set; }
        [JsonPropertyName("CODDEPARTAMENTO")]
        public JsonElement CodDepartamento { get; set; }
        [JsonPropertyName("CODDEPTO")]
        public JsonElement CodDepto { get; set; }
    }

    /// <summary>Linha de pessoa.json (PPESSOA) usada para sync de Funcionários a partir de Pessoas.</summary>
    private sealed class PessoaRowForFuncionario
    {
        [JsonPropertyName("CODIGO")]
        public int Codigo { get; set; }
        [JsonPropertyName("NOME")]
        public string? Nome { get; set; }
        [JsonPropertyName("EMAIL")]
        public string? Email { get; set; }
        [JsonPropertyName("TELEFONE1")]
        public string? Telefone1 { get; set; }
    }

    /// <summary>Resposta da API: Status vem como string (JsonStringEnumConverter).</summary>
    private sealed record FuncionarioResponse(Guid Id, string Name, string Email, string? Phone, string? Status, int Headcount,
        Guid? UnitId, string? UnitName, Guid? AreaId, string? AreaName, Guid? JobPositionId, string? JobPositionName,
        Guid? RequisitoCategoriaId, string? RequisitoCategoriaName,
        Guid? UserId, string? Notes, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);

    private sealed record FuncionarioGridRowResponse(Guid Id, string Name, string Email, string? Phone, string? Status, int Headcount,
        Guid? UnitId, string? UnitName, Guid? AreaId, string? AreaName, Guid? JobPositionId, string? JobPositionName,
        Guid? RequisitoCategoriaId, string? RequisitoCategoriaName);

    private sealed record PagedResult<T>(List<T>? Items, int Page, int PageSize, int TotalItems, int? TotalPages);

    private sealed record RequisitoCategoriaItem(Guid Id, string Code, string Name);

    private sealed record UnitGridRowResponse(Guid Id, string Name, string Code);

    private sealed record AreaItem(Guid Id, string Code, string Name);

    private sealed record ExistingFuncionario(Guid Id, Guid? UnitId, Guid? AreaId);

    private static string? GetFirstNonEmpty(params string?[] values)
    {
        foreach (var v in values)
            if (!string.IsNullOrWhiteSpace(v))
                return v.Trim();
        return null;
    }

    private static string? GetAsCode(JsonElement el)
    {
        if (el.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null) return null;
        var s = el.ValueKind == JsonValueKind.String ? el.GetString() : el.ToString();
        s = s?.Trim();
        return string.IsNullOrEmpty(s) ? null : s;
    }

    private static string? NormalizeCode(string? code) => string.IsNullOrWhiteSpace(code) ? null : code.Trim();
}
