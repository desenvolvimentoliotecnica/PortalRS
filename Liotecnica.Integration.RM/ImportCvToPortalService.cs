using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Pega até N candidatos a vaga que têm currículo em CV/, importa o PDF no Portal (cria Talento + Documento),
/// cria Candidato vinculado à Vaga e ao Talento. Usa candidato_vaga.json, candidato_perfil.json e CV/{CPF}/.
/// </summary>
public sealed class ImportCvToPortalService
{
    private const int DefaultTake = 10;
    private const int FonteIndicacao = 3;
    private const int StatusTriagem = 1;
    private const string EmailPlaceholder = "rm-sem-email@sincronizacao.local";

    private readonly ILogger<ImportCvToPortalService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public ImportCvToPortalService(
        ILogger<ImportCvToPortalService> logger,
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
    /// Pega até <paramref name="take"/> candidatos de candidato_vaga.json que têm CV em CV/{CPF}/,
    /// importa o PDF (POST api/talentos/import-pdf), cria Candidato com VagaId e TalentoId.
    /// </summary>
    public async Task<int> ImportCvCandidatesAsync(int take = DefaultTake, CancellationToken ct = default)
    {
        var basePath = GetSchemaTablesPath();
        var cvRoot = Path.Combine(basePath, "CV");
        var vagaPath = Path.Combine(basePath, "candidato_vaga.json");
        if (!File.Exists(vagaPath))
        {
            _logWriter.WriteLine("ImportCvToPortal: candidato_vaga.json não encontrado.");
            _logger.LogWarning("candidato_vaga.json não encontrado em {Path}.", basePath);
            return 0;
        }
        if (!Directory.Exists(cvRoot))
        {
            _logWriter.WriteLine("ImportCvToPortal: pasta CV/ não encontrada.");
            return 0;
        }

        var codigoToVagaId = await LoadVagasByCodigoAsync(ct);
        if (codigoToVagaId.Count == 0)
        {
            _logWriter.WriteLine("ImportCvToPortal: nenhuma vaga no Portal; sincronize vagas antes.");
            return 0;
        }

        var codPessoaToCvPath = ScanCvFoldersForCodPessoa(cvRoot);
        if (codPessoaToCvPath.Count == 0)
        {
            _logWriter.WriteLine("ImportCvToPortal: nenhum currículo encontrado em CV/ (curriculo.json com codPessoa).");
            return 0;
        }

        var candidatoPerfilByCodPessoa = await LoadCandidatoPerfilCvTextAsync(basePath, ct);

        var json = await File.ReadAllTextAsync(vagaPath, ct);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (root.ValueKind != JsonValueKind.Array)
        {
            _logWriter.WriteLine("ImportCvToPortal: candidato_vaga.json não é array.");
            return 0;
        }

        var imported = 0;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in root.EnumerateArray())
        {
            if (imported >= take) break;

            var codPessoa = GetString(row, "CODPESSOA")?.Trim();
            if (string.IsNullOrEmpty(codPessoa) || !codPessoaToCvPath.TryGetValue(codPessoa!, out var cvInfo))
                continue;

            var codVaga = GetString(row, "CODVAGA")?.Trim();
            if (string.IsNullOrEmpty(codVaga) || !codigoToVagaId.TryGetValue(codVaga!, out var vagaId))
                continue;

            var emailKey = (GetString(row, "EMAIL") ?? "").Trim();
            if (string.IsNullOrWhiteSpace(emailKey)) emailKey = EmailPlaceholder;
            var key = $"{vagaId}:{emailKey}";
            if (seen.Contains(key)) continue;
            seen.Add(key);

            var nome = (GetString(row, "NOMEPESSOA") ?? "").Trim();
            if (string.IsNullOrWhiteSpace(nome)) continue;
            if (nome.Length > 160) nome = nome.Substring(0, 160);
            var email = emailKey == EmailPlaceholder ? $"{codPessoa}@rm.sincronizacao.local" : emailKey;
            if (email.Length > 180) email = email.Substring(0, 180);
            var fone = GetString(row, "TELEFONE1") ?? GetString(row, "TELEFONE2");
            if (!string.IsNullOrWhiteSpace(fone) && fone!.Length > 40) fone = fone.Substring(0, 40);
            var cidade = GetString(row, "CIDADE")?.Trim();
            if (!string.IsNullOrWhiteSpace(cidade) && cidade!.Length > 120) cidade = cidade.Substring(0, 120);
            var uf = GetString(row, "ESTADO")?.Trim();
            if (!string.IsNullOrWhiteSpace(uf) && uf!.Length > 2) uf = uf.Substring(0, 2);

            Guid? talentoId = null;
            try
            {
                using var pdfStream = File.OpenRead(cvInfo.PdfPath);
                talentoId = await ImportPdfAndGetTalentoIdAsync(pdfStream, "curriculo.pdf", ct);
                if (!talentoId.HasValue)
                {
                    _logWriter.WriteLine($"ImportCvToPortal: import-pdf falhou para CODPESSOA={codPessoa}.");
                    continue;
                }

                candidatoPerfilByCodPessoa.TryGetValue(codPessoa!, out var cvText);
                if (!string.IsNullOrEmpty(cvText) && cvText.Length > 8000) cvText = cvText.Substring(0, 8000);
                var candidatoCreated = await CreateCandidatoAsync(vagaId, talentoId.Value, nome, email, fone, cidade, uf, cvText, ct);
                if (candidatoCreated)
                    imported++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ImportCvToPortal: falha para CODPESSOA={CodPessoa}.", codPessoa);
                _logWriter.WriteLine($"ImportCvToPortal: falha CODPESSOA={codPessoa} - {ex.Message}");
            }
        }

        _logWriter.WriteLine($"ImportCvToPortal: {imported} candidatos importados (talento + candidato na vaga).");
        _logger.LogInformation("ImportCvToPortal: {Count} candidatos importados.", imported);
        return imported;
    }

    /// <summary>
    /// Importa um PDF de currículo para um talento já existente (POST api/talentos/import-pdf com TalentoId).
    /// Atualiza o cadastro do talento com o documento; o job em background pode extrair dados do CV.
    /// </summary>
    public async Task<bool> ImportCvByTalentoAsync(Guid talentoId, string pdfPath, bool enviarParaGpt = false, CancellationToken ct = default)
    {
        if (!File.Exists(pdfPath))
        {
            _logger.LogWarning("Arquivo não encontrado: {Path}.", pdfPath);
            _logWriter.WriteLine($"ImportCvByTalento: arquivo não encontrado {pdfPath}");
            return false;
        }
        var fileName = Path.GetFileName(pdfPath);
        if (string.IsNullOrEmpty(fileName)) fileName = "curriculo.pdf";
        try
        {
            using var pdfStream = File.OpenRead(pdfPath);
            using var content = new MultipartFormDataContent();
            content.Add(new StringContent(talentoId.ToString()), "TalentoId");
            content.Add(new StringContent(enviarParaGpt ? "true" : "false"), "EnviarParaGpt");
            var fileContent = new StreamContent(pdfStream);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
            content.Add(fileContent, "Arquivo", fileName);

            var response = await _portalClient.Http.PostAsync("api/talentos/import-pdf", content, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Import-pdf por talento falhou: {Status} {Body}", response.StatusCode, body);
                _logWriter.WriteLine($"ImportCvByTalento: falhou {response.StatusCode} {body}");
                return false;
            }
            _logWriter.WriteLine($"ImportCvByTalento: PDF importado para talento {talentoId}.");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ImportCvByTalento: falha para talento {TalentoId}.", talentoId);
            _logWriter.WriteLine($"ImportCvByTalento: falha - {ex.Message}");
            return false;
        }
    }

    private async Task<Guid?> ImportPdfAndGetTalentoIdAsync(Stream pdfStream, string fileName, CancellationToken ct)
    {
        using var content = new MultipartFormDataContent();
        content.Add(new StringContent("false"), "EnviarParaGpt");
        var fileContent = new StreamContent(pdfStream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        content.Add(fileContent, "Arquivo", fileName ?? "curriculo.pdf");

        var response = await _portalClient.Http.PostAsync("api/talentos/import-pdf", content, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Import-pdf falhou: {Status} {Body}", response.StatusCode, body);
            return null;
        }

        var result = await response.Content.ReadFromJsonAsync<TalentoStartImportPdfResponse>(JsonOptions, ct);
        return result?.Talento?.Id;
    }

    private async Task<bool> CreateCandidatoAsync(Guid vagaId, Guid talentoId, string nome, string email, string? fone, string? cidade, string? uf, string? cvText, CancellationToken ct)
    {
        var payload = new
        {
            nome,
            email,
            fone,
            cidade,
            uf,
            fonte = FonteIndicacao,
            status = StatusTriagem,
            vagaId,
            talentoId,
            obs = (string?)null,
            cvText,
            lastMatch = (object?)null,
            documentos = (object?)null,
            applicationRecruiterUserId = (string?)null,
            applicationRecruiterUserName = (string?)null
        };

        var response = await _portalClient.Http.PostAsJsonAsync("api/candidatos", payload, JsonOptions, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _logWriter.WriteLine($"ImportCvToPortal: POST api/candidatos falhou: {response.StatusCode} {body}");
            return false;
        }
        return true;
    }

    private static Dictionary<string, (string PdfPath, string Folder)> ScanCvFoldersForCodPessoa(string cvRoot)
    {
        var map = new Dictionary<string, (string PdfPath, string Folder)>(StringComparer.OrdinalIgnoreCase);
        foreach (var dir in Directory.EnumerateDirectories(cvRoot))
        {
            var jsonPath = Path.Combine(dir, "curriculo.json");
            if (!File.Exists(jsonPath)) continue;
            try
            {
                var json = File.ReadAllText(jsonPath);
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                if (!root.TryGetProperty("codPessoa", out var el)) continue;
                var codPessoa = el.ValueKind == JsonValueKind.Number ? el.GetRawText() : el.GetString()?.Trim();
                if (string.IsNullOrEmpty(codPessoa)) continue;
                var pdfPath = Path.Combine(dir, "curriculo.pdf");
                if (!File.Exists(pdfPath)) continue;
                map[codPessoa] = (pdfPath, dir);
            }
            catch { /* ignore */ }
        }
        return map;
    }

    private async Task<Dictionary<string, Guid>> LoadVagasByCodigoAsync(CancellationToken ct)
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
        }
        return map;
    }

    private async Task<Dictionary<string, string>> LoadCandidatoPerfilCvTextAsync(string basePath, CancellationToken ct)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var file = Path.Combine(basePath, "candidato_perfil.json");
        if (!File.Exists(file)) return map;
        try
        {
            var json = await File.ReadAllTextAsync(file, ct);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Array) return map;
            foreach (var item in root.EnumerateArray())
            {
                var cp = item.TryGetProperty("CODPESSOA", out var el) ? (el.ValueKind == JsonValueKind.Number ? el.GetRawText() : el.GetString()?.Trim()) : null;
                var cv = GetStringFromElement(item, "CvText")?.Trim();
                if (!string.IsNullOrEmpty(cp) && !string.IsNullOrWhiteSpace(cv))
                    map[cp!] = cv!;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao carregar candidato_perfil.json.");
        }
        return map;
    }

    private static string? GetString(JsonElement row, string prop)
    {
        if (!row.TryGetProperty(prop, out var el)) return null;
        if (el.ValueKind == JsonValueKind.Null || el.ValueKind == JsonValueKind.Undefined) return null;
        if (el.ValueKind == JsonValueKind.String) return el.GetString();
        if (el.ValueKind == JsonValueKind.Number) return el.GetRawText();
        return el.GetRawText();
    }

    private static string? GetStringFromElement(JsonElement item, string prop)
    {
        if (!item.TryGetProperty(prop, out var el)) return null;
        if (el.ValueKind == JsonValueKind.String) return el.GetString();
        return el.GetRawText();
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
    private sealed record TalentoStartImportPdfResponse(TalentoResponse? Talento, object? Documento, object? ImportJob);
    private sealed record TalentoResponse(Guid Id, string Nome, string? Email, string? Fone, string? Cidade, string? Uf);
}
