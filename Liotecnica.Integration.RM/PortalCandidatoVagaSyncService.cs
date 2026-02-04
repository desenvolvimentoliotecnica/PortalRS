using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Sincroniza candidatos por vaga do RM (candidato_vaga.json) para o Portal (api/candidatos).
/// Usa CODVAGA para obter VagaId no Portal; upsert por (VagaId + Email) para evitar duplicata.
/// </summary>
public sealed class PortalCandidatoVagaSyncService
{
    private readonly ILogger<PortalCandidatoVagaSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly RmSyncOptions _syncOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    /// <summary>Fonte no Portal para candidatos vindos do RM: Indicacao = 3.</summary>
    private const int FonteIndicacao = 3;

    /// <summary>Status no Portal: Triagem = 1.</summary>
    private const int StatusTriagem = 1;

    /// <summary>Email placeholder quando PPESSOA não tem email (Portal exige email).</summary>
    private const string EmailPlaceholder = "rm-sem-email@sincronizacao.local";

    public PortalCandidatoVagaSyncService(
        ILogger<PortalCandidatoVagaSyncService> logger,
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
    /// Lê candidato_vaga.json e envia para api/candidatos (cria ou atualiza por VagaId + Email).
    /// Se emailToTalentoId for informado, vincula cada candidato ao Talento (dados de CV ficam no Talento).
    /// </summary>
    public async Task SyncCandidatosFromCandidatoVagaJsonAsync(
        CancellationToken ct = default,
        IReadOnlyDictionary<string, Guid>? emailToTalentoId = null)
    {
        try
        {
            await SyncCandidatosFromCandidatoVagaJsonCoreAsync(ct, emailToTalentoId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Candidatos por vaga: falha geral.");
            _logWriter.WriteLine($"Sync Candidatos por vaga: falha geral - {ex.Message}");
        }
    }

    private async Task SyncCandidatosFromCandidatoVagaJsonCoreAsync(CancellationToken ct, IReadOnlyDictionary<string, Guid>? emailToTalentoId = null)
    {
        var path = GetSchemaTablesPath();
        var file = Path.Combine(path, "candidato_vaga.json");
        if (!File.Exists(file))
        {
            _logWriter.WriteLine("Sync Candidatos por vaga: arquivo candidato_vaga.json não encontrado; rode a extração diagnóstica (SyncCandidatosVagaDiagnostic = true) antes.");
            _logger.LogWarning("Arquivo {File} não encontrado; pulando sync de candidatos.", file);
            return;
        }

        var json = await File.ReadAllTextAsync(file, ct);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (root.ValueKind != JsonValueKind.Array)
        {
            _logWriter.WriteLine("Sync Candidatos por vaga: candidato_vaga.json não é um array; pulando.");
            return;
        }

        var codigoToVagaId = await LoadExistingVagasByCodigoAsync(ct);
        if (codigoToVagaId.Count == 0)
        {
            _logWriter.WriteLine("Sync Candidatos por vaga: nenhuma vaga encontrada no Portal; sincronize vagas antes.");
            _logger.LogWarning("Sync Candidatos: nenhuma vaga no Portal; sincronize vagas antes.");
            return;
        }

        var created = 0;
        var updated = 0;
        var skipped = 0;
        var semTalento = 0;
        var errors = 0;

        foreach (var row in root.EnumerateArray())
        {
            if (_syncOptions.MaxCandidatosToSync.HasValue && (created + updated) >= _syncOptions.MaxCandidatosToSync.Value)
            {
                _logWriter.WriteLine($"Sync Candidatos por vaga: limite de {_syncOptions.MaxCandidatosToSync.Value} atingido; parando.");
                break;
            }
            try
            {
                var codVaga = GetString(row, "CODVAGA")?.Trim();
                if (string.IsNullOrEmpty(codVaga) || !codigoToVagaId.TryGetValue(codVaga!, out var vagaId))
                {
                    skipped++;
                    continue;
                }

                var nome = GetString(row, "NOMEPESSOA")?.Trim();
                if (string.IsNullOrWhiteSpace(nome))
                {
                    skipped++;
                    continue;
                }
                if (nome!.Length > 160) nome = nome.Substring(0, 160);

                var email = GetString(row, "EMAIL")?.Trim();
                if (string.IsNullOrWhiteSpace(email)) email = EmailPlaceholder;
                if (email!.Length > 180) email = email.Substring(0, 180);

                var fone = GetString(row, "TELEFONE1") ?? GetString(row, "TELEFONE2");
                if (!string.IsNullOrWhiteSpace(fone) && fone!.Length > 40) fone = fone.Substring(0, 40);

                var cidade = GetString(row, "CIDADE")?.Trim();
                if (!string.IsNullOrWhiteSpace(cidade) && cidade!.Length > 120) cidade = cidade.Substring(0, 120);

                var uf = GetString(row, "ESTADO")?.Trim();
                if (!string.IsNullOrWhiteSpace(uf) && uf!.Length > 2) uf = uf.Substring(0, 2);

                var emailNorm = email.Trim();
                if (!string.IsNullOrWhiteSpace(_syncOptions.SyncOnlyEmail) && !string.Equals(emailNorm, _syncOptions.SyncOnlyEmail.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    skipped++;
                    continue;
                }
                var talentoId = emailToTalentoId?.TryGetValue(emailNorm, out var tid) == true ? tid : (Guid?)null;

                // REGRA: todo candidato precisa de Talento antes (perfil profissional está no Talento). Se mapa foi passado e não há TalentoId, não criar/atualizar.
                if (emailToTalentoId != null && !talentoId.HasValue)
                {
                    semTalento++;
                    continue;
                }

                var existingByEmail = await GetCandidatoIdByVagaAndEmailAsync(vagaId, email, ct);
                if (existingByEmail.HasValue)
                {
                    var payload = BuildCandidateUpdatePayload(nome, email, fone, cidade, uf, vagaId, talentoId);
                    var response = await _portalClient.Http.PutAsJsonAsync($"api/candidatos/{existingByEmail.Value}", payload, JsonOptions, ct);
                    if (response.IsSuccessStatusCode)
                        updated++;
                    else
                    {
                        var msg = await response.Content.ReadAsStringAsync(ct);
                        _logWriter.WriteLine($"Sync Candidatos: PUT falhou Vaga={codVaga} Email={email}: {response.StatusCode}");
                        errors++;
                    }
                }
                else
                {
                    var payload = BuildCandidateCreatePayload(nome, email, fone, cidade, uf, vagaId, talentoId);
                    var response = await _portalClient.Http.PostAsJsonAsync("api/candidatos", payload, JsonOptions, ct);
                    if (response.IsSuccessStatusCode)
                        created++;
                    else
                    {
                        var msg = await response.Content.ReadAsStringAsync(ct);
                        _logWriter.WriteLine($"Sync Candidatos: POST falhou Vaga={codVaga} Email={email}: {response.StatusCode}");
                        errors++;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Sync Candidatos: exceção ao processar linha.");
                _logWriter.WriteLine($"Sync Candidatos: exceção - {ex.Message}");
                errors++;
            }
        }

        _logWriter.WriteLine($"Sync Candidatos por vaga: criados={created}, atualizados={updated}, ignorados={skipped}, semTalento={semTalento}, erros={errors}");
        _logger.LogInformation("Sync Candidatos por vaga: criados={Created}, atualizados={Updated}, ignorados={Skipped}, semTalento={SemTalento}, erros={Errors}", created, updated, skipped, semTalento, errors);
    }

    private static object BuildCandidateCreatePayload(string nome, string email, string? fone, string? cidade, string? uf, Guid vagaId, Guid? talentoId = null)
    {
        return new
        {
            nome,
            email,
            fone,
            cidade,
            uf,
            fonte = FonteIndicacao,
            status = StatusTriagem,
            vagaId,
            obs = (string?)null,
            cvText = (string?)null,
            lastMatch = (object?)null,
            documentos = (object?)null,
            applicationRecruiterUserId = (string?)null,
            applicationRecruiterUserName = (string?)null,
            talentoId
        };
    }

    private static object BuildCandidateUpdatePayload(string nome, string email, string? fone, string? cidade, string? uf, Guid vagaId, Guid? talentoId = null)
    {
        return new
        {
            nome,
            email,
            fone,
            cidade,
            uf,
            fonte = FonteIndicacao,
            status = StatusTriagem,
            vagaId,
            obs = (string?)null,
            cvText = (string?)null,
            lastMatch = (object?)null,
            documentos = (object?)null,
            statusChange = (object?)null,
            applicationRecruiterUserId = (string?)null,
            applicationRecruiterUserName = (string?)null,
            talentoId
        };
    }

    private static string? GetString(JsonElement row, string prop)
    {
        if (!row.TryGetProperty(prop, out var el)) return null;
        if (el.ValueKind == JsonValueKind.Null || el.ValueKind == JsonValueKind.Undefined) return null;
        if (el.ValueKind == JsonValueKind.String) return el.GetString();
        if (el.ValueKind == JsonValueKind.Number) return el.GetRawText();
        if (el.ValueKind == JsonValueKind.True || el.ValueKind == JsonValueKind.False) return el.GetBoolean().ToString();
        return el.GetRawText();
    }

    /// <summary>Carrega candidato_perfil.json (CODPESSOA -> CvText). Retorna vazio se o arquivo não existir.</summary>
    private async Task<Dictionary<string, string>> LoadCandidatoPerfilByCodPessoaAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var path = GetSchemaTablesPath();
        var file = Path.Combine(path, "candidato_perfil.json");
        if (!File.Exists(file)) return map;
        try
        {
            var json = await File.ReadAllTextAsync(file, ct);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Array) return map;
            foreach (var item in root.EnumerateArray())
            {
                var cp = item.TryGetProperty("CODPESSOA", out var el) ? (el.ValueKind == JsonValueKind.Number ? el.GetInt64().ToString() : el.GetString()?.Trim()) : null;
                var cv = GetString(item, "CvText")?.Trim();
                if (!string.IsNullOrEmpty(cp) && !string.IsNullOrWhiteSpace(cv))
                    map[cp!] = cv!;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao carregar candidato_perfil.json; CvText não será preenchido.");
        }
        return map;
    }

    private async Task<Dictionary<string, Guid>> LoadExistingVagasByCodigoAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var list = await _portalClient.Http.GetFromJsonAsync<List<VagaListItem>>("api/vagas", JsonOptions, ct);
            if (list != null)
                foreach (var v in list)
                {
                    var key = (v.Codigo ?? "").Trim();
                    if (!string.IsNullOrEmpty(key))
                        map[key] = v.Id;
                }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao carregar vagas do portal.");
            _logWriter.WriteLine($"Sync Candidatos: falha ao carregar vagas - {ex.Message}");
        }
        return map;
    }

    /// <summary>Retorna o Id do candidato na vaga com o mesmo email (normalizado), ou null.</summary>
    private async Task<Guid?> GetCandidatoIdByVagaAndEmailAsync(Guid vagaId, string email, CancellationToken ct)
    {
        var emailNorm = (email ?? "").Trim();
        if (string.IsNullOrEmpty(emailNorm)) return null;
        try
        {
            var page = 1;
            const int pageSize = 200;
            while (true)
            {
                var response = await _portalClient.Http.GetFromJsonAsync<CandidatePagedResponse>(
                    $"api/candidatos?vagaId={vagaId}&page={page}&pageSize={pageSize}", JsonOptions, ct);
                if (response?.Items == null || response.Items.Count == 0)
                    break;
                var match = response.Items.FirstOrDefault(c =>
                    string.Equals((c.Email ?? "").Trim(), emailNorm, StringComparison.OrdinalIgnoreCase));
                if (match != null)
                    return match.Id;
                if (response.Items.Count < pageSize)
                    break;
                page++;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao listar candidatos da vaga {VagaId}.", vagaId);
        }
        return null;
    }

    private string GetSchemaTablesPath()
    {
        var path = _outputOptions.SchemaTablesPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            return Path.IsPathRooted(path) ? path : Path.GetFullPath(path);
        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }

    private sealed record VagaListItem(Guid Id, string? Codigo, string Titulo);
    private sealed record CandidatePagedResponse(IReadOnlyList<CandidateListItem>? Items, int TotalCount, int Page, int PageSize);
    private sealed record CandidateListItem(Guid Id, string Nome, string Email, string? Fone, string? Cidade, string? Uf, Guid? VagaId);
}
