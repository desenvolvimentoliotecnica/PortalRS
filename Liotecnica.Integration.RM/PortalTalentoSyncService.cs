using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Sincroniza pessoas do RM (candidato_vaga.json + candidato_perfil.json) para o cadastro de **Talento** no Portal (api/talentos).
/// Dados de CV (formação, experiência, competências) vão para o Talento (ResumoProfissional). Retorna mapa email → TalentoId para vincular Candidato ao Talento.
/// </summary>
public sealed class PortalTalentoSyncService
{
    private readonly ILogger<PortalTalentoSyncService> _logger;
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

    /// <summary>Origem no Portal: Manual = 4 (RM integrado).</summary>
    private const int OrigemManual = 4;

    private const string EmailPlaceholder = "rm-sem-email@sincronizacao.local";

    public PortalTalentoSyncService(
        ILogger<PortalTalentoSyncService> logger,
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
    /// Lê candidato_vaga.json + candidato_perfil.json, cria ou encontra Talento por email e retorna mapa email (normalizado) → TalentoId.
    /// </summary>
    public async Task<IReadOnlyDictionary<string, Guid>> SyncTalentosAndGetEmailToIdMapAsync(CancellationToken ct = default)
    {
        var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        try
        {
            await SyncTalentosAndGetEmailToIdMapCoreAsync(map, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Talentos: falha geral.");
            _logWriter.WriteLine($"Sync Talentos: falha geral - {ex.Message}");
        }
        return map;
    }

    private async Task SyncTalentosAndGetEmailToIdMapCoreAsync(Dictionary<string, Guid> emailToTalentoId, CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var vagaFile = Path.Combine(path, "candidato_vaga.json");
        if (!File.Exists(vagaFile))
        {
            var fallbackPath = GetSchemaTablesPathFallback();
            if (!string.IsNullOrEmpty(fallbackPath))
            {
                var fallbackVaga = Path.Combine(fallbackPath, "candidato_vaga.json");
                if (File.Exists(fallbackVaga))
                {
                    path = fallbackPath;
                    vagaFile = fallbackVaga;
                    _logWriter.WriteLine($"Sync Talentos: usando candidato_vaga.json em {path}");
                }
            }
        }
        if (!File.Exists(vagaFile))
        {
            _logWriter.WriteLine("Sync Talentos: candidato_vaga.json não encontrado.");
            _logger.LogWarning("candidato_vaga.json não encontrado; pulando sync de talentos.");
            return;
        }

        var json = await File.ReadAllTextAsync(vagaFile, ct);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (root.ValueKind != JsonValueKind.Array)
        {
            _logWriter.WriteLine("Sync Talentos: candidato_vaga.json não é array.");
            return;
        }

        var perfilByCodPessoa = await LoadPerfilStructuredByCodPessoaAsync(ct, path);

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var created = 0;
        var reused = 0;
        var errors = 0;

        foreach (var row in root.EnumerateArray())
        {
            if (_syncOptions.MaxTalentosToSync.HasValue && (created + reused) >= _syncOptions.MaxTalentosToSync.Value)
            {
                _logWriter.WriteLine($"Sync Talentos: limite de {_syncOptions.MaxTalentosToSync.Value} atingido; parando.");
                break;
            }
            var email = GetString(row, "EMAIL")?.Trim();
            if (string.IsNullOrWhiteSpace(email)) email = EmailPlaceholder;
            if (email!.Length > 180) email = email.Substring(0, 180);
            var emailNorm = email.Trim();
            if (seen.Contains(emailNorm)) continue;
            if (!string.IsNullOrWhiteSpace(_syncOptions.SyncOnlyEmail) && !string.Equals(emailNorm, _syncOptions.SyncOnlyEmail.Trim(), StringComparison.OrdinalIgnoreCase))
                continue;
            seen.Add(emailNorm);

            var nome = GetString(row, "NOMEPESSOA")?.Trim();
            if (string.IsNullOrWhiteSpace(nome)) continue;
            if (nome!.Length > 160) nome = nome.Substring(0, 160);

            var fone = GetString(row, "TELEFONE1") ?? GetString(row, "TELEFONE2");
            if (!string.IsNullOrWhiteSpace(fone) && fone!.Length > 40) fone = fone.Substring(0, 40);

            var cidade = GetString(row, "CIDADE")?.Trim();
            if (!string.IsNullOrWhiteSpace(cidade) && cidade!.Length > 120) cidade = cidade.Substring(0, 120);

            var uf = GetString(row, "ESTADO")?.Trim();
            if (!string.IsNullOrWhiteSpace(uf) && uf!.Length > 2) uf = uf.Substring(0, 2);

            var codPessoaRaw = GetString(row, "CODPESSOA");
            var codPessoa = string.IsNullOrWhiteSpace(codPessoaRaw) ? string.Empty : codPessoaRaw!.Trim();
            perfilByCodPessoa.TryGetValue(codPessoa, out var perfil);
            // #region agent log
            try
            {
                var isClayton = string.Equals(emailNorm, "claytonhamada@gmail.com", StringComparison.OrdinalIgnoreCase);
                if (isClayton)
                {
                    var fc = perfil?.Formacao?.Count ?? 0;
                    var ec = perfil?.Experiencias?.Count ?? 0;
                    var cc = perfil?.Competencias?.Count ?? 0;
                    var tc = perfil?.Treinamentos?.Count ?? 0;
                    var line = System.Text.Json.JsonSerializer.Serialize(new { hypothesisId = "H1-H3", location = "PortalTalentoSyncService.SyncCore", message = "perfil lookup", data = new { email = emailNorm, codPessoa, perfilFound = perfil != null, formacaoCount = fc, experienciasCount = ec, competenciasCount = cc, treinamentosCount = tc }, timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), sessionId = "debug-session" }) + "\n";
                    await System.IO.File.AppendAllTextAsync("/Users/victoralves/Projects/Voltage.RenderRH/.cursor/debug.log", line, ct);
                }
            }
            catch { /* ignore */ }
            // #endregion
            var resumoProfissional = perfil?.CvText;
            if (!string.IsNullOrWhiteSpace(resumoProfissional) && resumoProfissional!.Length > 2000) resumoProfissional = resumoProfissional.Substring(0, 2000);

            var competencias = BuildCompetenciasApi(perfil?.Competencias);
            var experiencias = BuildExperienciasApi(perfil?.Experiencias);
            var treinamentos = BuildTreinamentosApi(perfil?.Treinamentos);
            var formacao = BuildFormacaoApi(perfil?.Formacao);
            var documentos = BuildDocumentosApi(perfil);

            object BuildPayload(bool forceCreate)
            {
                return new
                {
                    nome,
                    email,
                    fone,
                    cidade,
                    uf,
                    linkedinUrl = (string?)null,
                    resumoProfissional,
                    obs = (string?)null,
                    origem = OrigemManual,
                    cpf = (string?)null,
                    dataNascimento = (DateTime?)null,
                    cep = (string?)null,
                    logradouro = (string?)null,
                    numero = (string?)null,
                    bairro = (string?)null,
                    forceCreate,
                    competencias,
                    experiencias,
                    treinamentos,
                    formacao,
                    documentos
                };
            }

            try
            {
                var response = await PostTalentoWithConcurrencyRetryAsync(BuildPayload(false), emailNorm, "POST", ct);
                if (response.IsSuccessStatusCode)
                {
                    var createdResp = await response.Content.ReadFromJsonAsync<TalentoResponse>(JsonOptions, ct);
                    if (createdResp != null)
                    {
                        emailToTalentoId[emailNorm] = createdResp.Id;
                        created++;
                        // #region agent log
                        try
                        {
                            if (string.Equals(emailNorm, "claytonhamada@gmail.com", StringComparison.OrdinalIgnoreCase))
                            {
                                var line = System.Text.Json.JsonSerializer.Serialize(new { hypothesisId = "H4", location = "PortalTalentoSyncService.SyncCore", message = "201 created", data = new { email = emailNorm, talentoId = createdResp.Id }, timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), sessionId = "debug-session" }) + "\n";
                                await System.IO.File.AppendAllTextAsync("/Users/victoralves/Projects/Voltage.RenderRH/.cursor/debug.log", line, ct);
                            }
                        }
                        catch { /* ignore */ }
                        // #endregion
                    }
                    else
                    {
                        errors++;
                        _logWriter.WriteLine($"Sync Talentos: 201 mas resposta vazia/inválida Email={email}");
                    }
                }
                else if (response.StatusCode == System.Net.HttpStatusCode.Conflict)
                {
                    var conflict = await response.Content.ReadFromJsonAsync<CreateTalentoConflictResponse>(JsonOptions, ct);
                    if (conflict?.SimilarTalentoId != null)
                    {
                        var existingTalentoId = conflict.SimilarTalentoId.Value;
                        emailToTalentoId[emailNorm] = existingTalentoId;
                        reused++;
                        // Quando reutilizamos um talento existente (409), atualizar o perfil via PUT para que Formação/Experiências/Competências/Treinamentos/Resumo apareçam no Portal.
                        var hasProfileData = !string.IsNullOrWhiteSpace(resumoProfissional)
                            || (perfil?.Formacao?.Count ?? 0) > 0
                            || (perfil?.Experiencias?.Count ?? 0) > 0
                            || (perfil?.Competencias?.Count ?? 0) > 0
                            || (perfil?.Treinamentos?.Count ?? 0) > 0;
                        if (hasProfileData)
                        {
                            try
                            {
                                var formacaoCount = (perfil?.Formacao?.Count ?? 0);
                                var expCount = (perfil?.Experiencias?.Count ?? 0);
                                var treinCount = (perfil?.Treinamentos?.Count ?? 0);
                                var compCount = (perfil?.Competencias?.Count ?? 0);
                                _logger.LogInformation("Sync Talentos: enviando PUT perfil para {Email} (formacao={F}, experiencias={E}, treinamentos={T}, competencias={C})", emailNorm, formacaoCount, expCount, treinCount, compCount);
                                var updatePayload = new
                                {
                                    nome,
                                    email,
                                    fone,
                                    cidade,
                                    uf,
                                    linkedinUrl = (string?)null,
                                    resumoProfissional,
                                    obs = (string?)null,
                                    cpf = (string?)null,
                                    dataNascimento = (DateTime?)null,
                                    cep = (string?)null,
                                    logradouro = (string?)null,
                                    numero = (string?)null,
                                    bairro = (string?)null,
                                    origem = OrigemManual,
                                    competencias,
                                    experiencias,
                                    treinamentos,
                                    formacao
                                };
                                var putResponse = await _portalClient.Http.PutAsJsonAsync($"api/talentos/{existingTalentoId}", updatePayload, JsonOptions, ct);
                                if (!putResponse.IsSuccessStatusCode)
                                {
                                    var putBody = await putResponse.Content.ReadAsStringAsync(ct);
                                    _logger.LogWarning("Sync Talentos: PUT perfil (reused) falhou Email={Email} TalentoId={Id} Status={Status} Body={Body}", emailNorm, existingTalentoId, putResponse.StatusCode, putBody);
                                    _logWriter.WriteLine($"Sync Talentos: PUT perfil falhou Email={emailNorm} TalentoId={existingTalentoId} {putResponse.StatusCode} {putBody}");
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Sync Talentos: exceção ao atualizar perfil (reused) para {Email}.", emailNorm);
                            }
                        }
                        // #region agent log
                        try
                        {
                            if (string.Equals(emailNorm, "claytonhamada@gmail.com", StringComparison.OrdinalIgnoreCase))
                            {
                                var putOk = hasProfileData; // PUT was sent when hasProfileData
                                var line = System.Text.Json.JsonSerializer.Serialize(new { hypothesisId = "H2", location = "PortalTalentoSyncService.SyncCore", message = "409 reused - profile PUT " + (putOk ? "sent" : "skipped (no profile data)"), data = new { email = emailNorm, similarTalentoId = conflict.SimilarTalentoId, hasProfileData }, timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), sessionId = "debug-session" }) + "\n";
                                await System.IO.File.AppendAllTextAsync("/Users/victoralves/Projects/Voltage.RenderRH/.cursor/debug.log", line, ct);
                            }
                        }
                        catch { /* ignore */ }
                        // #endregion
                    }
                    else
                    {
                        // Pessoa similar existe mas sem Talento: forçar criação do Talento (regra: todo candidato precisa de Talento antes).
                        var retryResponse = await PostTalentoWithConcurrencyRetryAsync(BuildPayload(true), emailNorm, "POST forceCreate", ct);
                        if (retryResponse.IsSuccessStatusCode)
                        {
                            var createdResp = await retryResponse.Content.ReadFromJsonAsync<TalentoResponse>(JsonOptions, ct);
                            if (createdResp != null)
                            {
                                emailToTalentoId[emailNorm] = createdResp.Id;
                                created++;
                            }
                            else
                            {
                                errors++;
                                _logWriter.WriteLine($"Sync Talentos: 201 (forceCreate) mas resposta vazia Email={email}");
                            }
                        }
                        else
                        {
                            errors++;
                            var body = await retryResponse.Content.ReadAsStringAsync(ct);
                            if (IsOptimisticConcurrencyBody(body))
                                _logWriter.WriteLine($"Sync Talentos: concorrencia persistente no POST forceCreate Email={email}; item sera reprocessado no proximo ciclo.");
                            else
                                _logWriter.WriteLine($"Sync Talentos: 409 sem SimilarTalentoId, retry forceCreate falhou Email={email}: {retryResponse.StatusCode} {body}");
                        }
                    }
                }
                else
                {
                    errors++;
                    var msg = await response.Content.ReadAsStringAsync(ct);
                    if (IsOptimisticConcurrencyBody(msg))
                        _logWriter.WriteLine($"Sync Talentos: concorrencia persistente no POST Email={email}; item sera reprocessado no proximo ciclo.");
                    else
                        _logWriter.WriteLine($"Sync Talentos: POST falhou Email={email}: {response.StatusCode} {msg}");
                    _logger.LogError("Sync Talentos: POST falhou Email={Email} Status={Status} Body={Body}", email, response.StatusCode, msg);
                }
            }
            catch (Exception ex)
            {
                errors++;
                _logger.LogWarning(ex, "Sync Talentos: exceção ao criar Talento para {Email}.", email);
            }
        }

        _logWriter.WriteLine($"Sync Talentos: criados={created}, reutilizados (similar)={reused}, erros={errors}; mapa com {emailToTalentoId.Count} entradas.");
        _logger.LogInformation("Sync Talentos: criados={Created}, reutilizados={Reused}, erros={Errors}", created, reused, errors);
    }

    private async Task<HttpResponseMessage> PostTalentoWithConcurrencyRetryAsync(
        object payload,
        string email,
        string operation,
        CancellationToken ct)
    {
        const int maxAttempts = 3;
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            var response = await _portalClient.Http.PostAsJsonAsync("api/talentos", payload, JsonOptions, ct);
            if (attempt >= maxAttempts || !await IsOptimisticConcurrencyResponseAsync(response, ct))
                return response;

            response.Dispose();
            var nextAttempt = attempt + 1;
            _logger.LogInformation("Sync Talentos: concorrencia transitoria no {Operation} para {Email}; retry {Attempt}/{MaxAttempts}.", operation, email, nextAttempt, maxAttempts);
            await Task.Delay(TimeSpan.FromMilliseconds(350 * attempt), ct);
        }

        throw new InvalidOperationException("Fluxo de retry de talentos terminou sem resposta HTTP.");
    }

    private static async Task<bool> IsOptimisticConcurrencyResponseAsync(HttpResponseMessage response, CancellationToken ct)
    {
        if (response.StatusCode != System.Net.HttpStatusCode.InternalServerError)
            return false;

        var body = await response.Content.ReadAsStringAsync(ct);
        return IsOptimisticConcurrencyBody(body);
    }

    private static bool IsOptimisticConcurrencyBody(string? body)
    {
        if (string.IsNullOrWhiteSpace(body))
            return false;

        return body.Contains("expected to affect 1 row", StringComparison.OrdinalIgnoreCase)
            || body.Contains("optimistic concurrency", StringComparison.OrdinalIgnoreCase)
            || body.Contains("DbUpdateConcurrencyException", StringComparison.OrdinalIgnoreCase);
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

    private sealed record PerfilStructured(
        string? CvText,
        IReadOnlyList<PerfilFormacaoItem> Formacao,
        IReadOnlyList<PerfilExperienciaItem> Experiencias,
        IReadOnlyList<PerfilCompetenciaItem> Competencias,
        IReadOnlyList<PerfilTreinamentoItem> Treinamentos);

    private sealed record PerfilFormacaoItem(string Curso, string? Instituicao, string? Inicio, string? Fim);
    private sealed record PerfilExperienciaItem(string Empresa, string Cargo);
    private sealed record PerfilCompetenciaItem(string Nome);
    private sealed record PerfilTreinamentoItem(string Nome);

    private async Task<Dictionary<string, PerfilStructured>> LoadPerfilStructuredByCodPessoaAsync(CancellationToken ct, string? basePath = null)
    {
        var map = new Dictionary<string, PerfilStructured>(StringComparer.OrdinalIgnoreCase);
        var path = basePath ?? GetSchemaTablesPath();
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
                if (string.IsNullOrEmpty(cp)) continue;
                var cv = GetString(item, "CvText")?.Trim();
                var formacao = ReadFormacaoList(item);
                var experiencias = ReadExperienciasList(item);
                var competencias = ReadCompetenciasList(item);
                var treinamentos = ReadTreinamentosList(item);
                if (string.IsNullOrWhiteSpace(cv) && formacao.Count == 0 && experiencias.Count == 0 && competencias.Count == 0 && treinamentos.Count == 0)
                    continue;
                map[cp!] = new PerfilStructured(cv, formacao, experiencias, competencias, treinamentos);
            }
        }
        catch (Exception ex) { _logger.LogWarning(ex, "Falha ao carregar candidato_perfil.json."); }
        return map;
    }

    private static List<PerfilFormacaoItem> ReadFormacaoList(JsonElement item)
    {
        var list = new List<PerfilFormacaoItem>();
        if (!item.TryGetProperty("Formacao", out var arr) || arr.ValueKind != JsonValueKind.Array) return list;
        foreach (var el in arr.EnumerateArray())
        {
            var curso = GetString(el, "Curso")?.Trim() ?? "";
            if (string.IsNullOrEmpty(curso)) continue;
            list.Add(new PerfilFormacaoItem(curso, GetString(el, "Instituicao")?.Trim(), GetString(el, "Inicio")?.Trim(), GetString(el, "Fim")?.Trim()));
        }
        return list;
    }

    private static List<PerfilExperienciaItem> ReadExperienciasList(JsonElement item)
    {
        var list = new List<PerfilExperienciaItem>();
        if (!item.TryGetProperty("Experiencias", out var arr) || arr.ValueKind != JsonValueKind.Array) return list;
        foreach (var el in arr.EnumerateArray())
        {
            var empresa = GetString(el, "Empresa")?.Trim() ?? "";
            var cargo = GetString(el, "Cargo")?.Trim() ?? "";
            if (string.IsNullOrEmpty(empresa)) empresa = "-";
            if (string.IsNullOrEmpty(cargo)) cargo = "-";
            list.Add(new PerfilExperienciaItem(empresa, cargo));
        }
        return list;
    }

    private static List<PerfilCompetenciaItem> ReadCompetenciasList(JsonElement item)
    {
        var list = new List<PerfilCompetenciaItem>();
        if (!item.TryGetProperty("Competencias", out var arr) || arr.ValueKind != JsonValueKind.Array) return list;
        foreach (var el in arr.EnumerateArray())
        {
            var nome = GetString(el, "Nome")?.Trim() ?? "";
            if (string.IsNullOrEmpty(nome)) continue;
            list.Add(new PerfilCompetenciaItem(nome));
        }
        return list;
    }

    private static List<PerfilTreinamentoItem> ReadTreinamentosList(JsonElement item)
    {
        var list = new List<PerfilTreinamentoItem>();
        if (!item.TryGetProperty("Treinamentos", out var arr) || arr.ValueKind != JsonValueKind.Array) return list;
        foreach (var el in arr.EnumerateArray())
        {
            var nome = GetString(el, "Nome")?.Trim() ?? "";
            if (string.IsNullOrEmpty(nome)) continue;
            list.Add(new PerfilTreinamentoItem(nome));
        }
        return list;
    }

    private static object? BuildCompetenciasApi(IReadOnlyList<PerfilCompetenciaItem>? comp)
    {
        if (comp == null || comp.Count == 0) return null;
        return comp.Select(c => new { id = (Guid?)null, tipo = "Outro", nome = Trunc(c.Nome, 120), nivel = "Não informado", evidencia = (string?)null, tempoAtuacao = (string?)null }).ToList();
    }

    private static object? BuildExperienciasApi(IReadOnlyList<PerfilExperienciaItem>? exp)
    {
        if (exp == null || exp.Count == 0) return null;
        return exp.Select(e => new { id = (Guid?)null, empresa = Trunc(e.Empresa, 160), cargo = Trunc(e.Cargo, 160), inicio = (string?)null, fim = (string?)null, tipoContratacao = (string?)null, local = (string?)null, atividades = (string?)null, resumoAtividades = (string?)null, nivelSenioridade = (string?)null, nivelHierarquico = (string?)null }).ToList();
    }

    private static object? BuildTreinamentosApi(IReadOnlyList<PerfilTreinamentoItem>? trei)
    {
        if (trei == null || trei.Count == 0) return null;
        return trei.Select(t => new { id = (Guid?)null, nome = Trunc(t.Nome, 160), instituicao = (string?)null, ano = (string?)null, link = (string?)null }).ToList();
    }

    private static object? BuildFormacaoApi(IReadOnlyList<PerfilFormacaoItem>? form)
    {
        if (form == null || form.Count == 0) return null;
        return form.Select(f => new { id = (Guid?)null, curso = Trunc(f.Curso, 160), instituicao = Trunc(f.Instituicao ?? "", 160), tipo = (string?)null, status = (string?)null, inicio = f.Inicio, fim = f.Fim, observacoes = (string?)null, link = (string?)null }).ToList();
    }

    private static object? BuildDocumentosApi(PerfilStructured? perfil)
    {
        if (perfil == null) return null;
        var hasData = !string.IsNullOrWhiteSpace(perfil.CvText)
            || (perfil.Formacao?.Count ?? 0) > 0
            || (perfil.Experiencias?.Count ?? 0) > 0
            || (perfil.Competencias?.Count ?? 0) > 0
            || (perfil.Treinamentos?.Count ?? 0) > 0;
        if (!hasData) return null;
        return new List<object> { new { nomeArquivo = "Currículo (RM)", descricao = "Dados de formação, experiência e competências sincronizados do RM" } };
    }

    private static string Trunc(string? value, int maxLen)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        return value!.Length <= maxLen ? value : value.Substring(0, maxLen);
    }

    private string GetSchemaTablesPath()
    {
        var path = _outputOptions.SchemaTablesPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            return Path.IsPathRooted(path) ? path : Path.GetFullPath(path);
        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }

    private string? GetSchemaTablesPathFallback()
    {
        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }

    private sealed record TalentoResponse(Guid Id, Guid PessoaId, string Nome, string Email);

    private sealed record CreateTalentoConflictResponse(bool SimilarFound, Guid? SimilarTalentoId, object? SimilarPessoaSummary);
}
