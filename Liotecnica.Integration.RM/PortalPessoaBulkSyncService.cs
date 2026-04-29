using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Sync rápido de pessoas (PPESSOA) para o portal usando endpoint /api/pessoas/bulk.
/// Pula CODPESSOAs que já são funcionários (já populados via PortalFuncionarioSync).
/// Sobram ~2700 candidatos puros / ex-funcionários, enviados em chunks de 500.
/// </summary>
public sealed class PortalPessoaBulkSyncService
{
    private readonly ILogger<PortalPessoaBulkSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly RmSyncOptions _syncOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;
    private readonly RmSyncCancellationService _cancellation;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
        Converters = { new NumberOrStringConverter() },
    };

    /// <summary>Lê string OU número como string. PPESSOA tem campos como NIT que ora vêm como número, ora como string.</summary>
    private sealed class NumberOrStringConverter : JsonConverter<string?>
    {
        public override string? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
            reader.TokenType switch
            {
                JsonTokenType.String => reader.GetString(),
                JsonTokenType.Number => reader.TryGetInt64(out var l) ? l.ToString() : reader.GetDecimal().ToString(System.Globalization.CultureInfo.InvariantCulture),
                JsonTokenType.Null => null,
                _ => null,
            };
        public override void Write(Utf8JsonWriter writer, string? value, JsonSerializerOptions options)
        {
            if (value is null) writer.WriteNullValue();
            else writer.WriteStringValue(value);
        }
    }

    public PortalPessoaBulkSyncService(
        ILogger<PortalPessoaBulkSyncService> logger,
        PortalApiClient portalClient,
        IOptions<OutputOptions> outputOptions,
        IOptions<RmSyncOptions> syncOptions,
        IHostEnvironment env,
        ExtractionLogWriter logWriter,
        RmSyncCancellationService cancellation)
    {
        _logger = logger;
        _portalClient = portalClient;
        _outputOptions = outputOptions.Value;
        _syncOptions = syncOptions.Value;
        _env = env;
        _logWriter = logWriter;
        _cancellation = cancellation;
    }

    public async Task SyncAsync(CancellationToken ct = default)
    {
        try { await SyncCoreAsync(ct); }
        catch (RmSyncCancellationRequestedException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Pessoas (bulk): falha geral.");
            _logWriter.WriteLine($"Sync Pessoas (bulk): falha geral - {ex.Message}");
        }
    }

    private async Task SyncCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var pessoaFile = Path.Combine(path, "pessoa.json");
        var funcFile = Path.Combine(path, "funcionario.json");
        if (!File.Exists(pessoaFile)) { _logWriter.WriteLine("Sync Pessoas (bulk): pessoa.json não existe."); return; }

        var pessoas = JsonSerializer.Deserialize<List<PessoaRow>>(await File.ReadAllTextAsync(pessoaFile, ct), JsonOptions) ?? new();
        var funcCodPessoas = new HashSet<int>();
        if (File.Exists(funcFile))
        {
            var funcs = JsonSerializer.Deserialize<List<FuncRow>>(await File.ReadAllTextAsync(funcFile, ct), JsonOptions) ?? new();
            foreach (var f in funcs)
                if (f.CodPessoa.HasValue) funcCodPessoas.Add(f.CodPessoa.Value);
        }

        // Filtra: só pessoas que NÃO são funcionárias (CODPESSOA não está em PFUNC.CODPESSOA)
        var naoFuncionarios = pessoas
            .Where(p => p.Codigo > 0 && !funcCodPessoas.Contains(p.Codigo))
            .ToList();
        var semNome = naoFuncionarios.Count(p => string.IsNullOrWhiteSpace(p.Nome));
        var candidatosComNome = naoFuncionarios
            .Where(p => !string.IsNullOrWhiteSpace(p.Nome))
            .ToList();
        var semChaveMinima = candidatosComNome.Count(p =>
            string.IsNullOrWhiteSpace(p.Cpf) && string.IsNullOrWhiteSpace(p.Email));
        var candidatos = candidatosComNome
            .Where(p => !string.IsNullOrWhiteSpace(p.Cpf) || !string.IsNullOrWhiteSpace(p.Email))
            .ToList();

        if (_syncOptions.MaxPessoasToSync is int cap && cap > 0 && candidatos.Count > cap)
        {
            _logWriter.WriteLine($"Sync Pessoas (bulk): limitando envio a {cap} (de {candidatos.Count}) via RmSync:MaxPessoasToSync.");
            candidatos = candidatos.Take(cap).ToList();
        }

        _logWriter.WriteLine($"Sync Pessoas (bulk): total PPESSOA={pessoas.Count}, funcionarios ignorados={funcCodPessoas.Count}, sem nome={semNome}, sem CPF/e-mail={semChaveMinima}, enviados={candidatos.Count}");

        if (candidatos.Count == 0) { _logWriter.WriteLine("Sync Pessoas (bulk): nada a enviar."); return; }

        var items = candidatos.Select(p => new
        {
            nome = p.Nome,
            email = string.IsNullOrWhiteSpace(p.Email) ? null : p.Email!.Trim().ToLowerInvariant(),
            cpf = p.Cpf?.Trim(),
            telefone = p.Telefone1?.Trim(),
            telefone2 = p.Telefone2?.Trim(),
            cep = p.Cep?.Trim(),
            logradouro = p.Rua?.Trim(),
            numero = p.Numero?.Trim(),
            complemento = p.Complemento?.Trim(),
            bairro = p.Bairro?.Trim(),
            cidade = p.Cidade?.Trim(),
            uf = p.Estado?.Trim(),
            dataNascimento = p.DtNascimento,
            sexo = p.Sexo?.Trim(),
            estadoCivil = p.EstadoCivil?.Trim(),
            naturalidade = p.Naturalidade?.Trim(),
            estadoNatal = p.EstadoNatal?.Trim(),
            grauInstrucao = p.GrauInstrucao?.Trim(),
            nacionalidade = p.Nacionalidade?.Trim(),
            rg = p.CartIdentidade?.Trim(),
            rgOrgEmissor = p.OrgEmissorIdent?.Trim(),
            rgUf = p.UfCartIdent?.Trim(),
            rgDataEmissao = p.DtEmissaoIdent,
            carteiraTrabalho = p.CarteiraTrab?.Trim(),
            carteiraTrabalhoSerie = p.SerieCartTrab?.Trim(),
            carteiraTrabalhoUf = p.UfCartTrab?.Trim(),
            carteiraTrabalhoData = p.DtCartTrab,
            numeroPis = p.Nit?.Trim(),
            tituloEleitor = p.TituloEleitor?.Trim(),
            tituloEleitorZona = p.ZonaTitEleitor?.Trim(),
            tituloEleitorSecao = p.SecaoTitEleitor?.Trim(),
            certificadoReservista = p.CertifReserv?.Trim(),
            categoriaMilitar = p.CategMilitar?.Trim(),
        }).Cast<object>().ToList();

        const int chunkSize = 500;
        var totalCreated = 0;
        var totalUpdated = 0;
        var totalSkipped = 0;
        for (int i = 0; i < items.Count; i += chunkSize)
        {
            _cancellation.ThrowIfCancellationRequested();
            var chunk = items.Skip(i).Take(chunkSize).ToList();
            var body = new { items = chunk };
            _logWriter.WriteLine($"Sync Pessoas (bulk): chunk {i / chunkSize + 1} ({chunk.Count} itens)");
            var resp = await _portalClient.Http.PostAsJsonAsync("api/pessoas/bulk", body, JsonOptions, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var msg = await resp.Content.ReadAsStringAsync(ct);
                _logWriter.WriteLine($"Sync Pessoas (bulk): ERRO chunk: {resp.StatusCode} {msg}");
                _logger.LogWarning("POST chunk falhou: {Status} {Msg}", resp.StatusCode, msg);
                return;
            }
            var result = await resp.Content.ReadFromJsonAsync<BulkResponse>(JsonOptions, ct);
            totalCreated += result?.Created ?? 0;
            totalUpdated += result?.Updated ?? 0;
            totalSkipped += result?.Skipped ?? 0;
        }
        _logWriter.WriteLine($"Sync Pessoas (bulk): OK - criadas={totalCreated}, atualizadas={totalUpdated}, ignoradas={totalSkipped}, ignoradas antes do envio={semNome + semChaveMinima}, total enviado={items.Count}");
    }

    private string GetSchemaTablesPath()
    {
        var path = _outputOptions.SchemaTablesPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            return Path.IsPathRooted(path) ? path : Path.GetFullPath(path);
        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }

    private sealed class FuncRow
    {
        [JsonPropertyName("CODPESSOA")] public int? CodPessoa { get; set; }
    }

    private sealed class PessoaRow
    {
        [JsonPropertyName("CODIGO")] public int Codigo { get; set; }
        [JsonPropertyName("NOME")] public string? Nome { get; set; }
        [JsonPropertyName("EMAIL")] public string? Email { get; set; }
        [JsonPropertyName("CPF")] public string? Cpf { get; set; }
        [JsonPropertyName("TELEFONE1")] public string? Telefone1 { get; set; }
        [JsonPropertyName("TELEFONE2")] public string? Telefone2 { get; set; }
        [JsonPropertyName("CEP")] public string? Cep { get; set; }
        [JsonPropertyName("RUA")] public string? Rua { get; set; }
        [JsonPropertyName("NUMERO")] public string? Numero { get; set; }
        [JsonPropertyName("COMPLEMENTO")] public string? Complemento { get; set; }
        [JsonPropertyName("BAIRRO")] public string? Bairro { get; set; }
        [JsonPropertyName("CIDADE")] public string? Cidade { get; set; }
        [JsonPropertyName("ESTADO")] public string? Estado { get; set; }
        [JsonPropertyName("DTNASCIMENTO")] public DateTime? DtNascimento { get; set; }
        [JsonPropertyName("SEXO")] public string? Sexo { get; set; }
        [JsonPropertyName("ESTADOCIVIL")] public string? EstadoCivil { get; set; }
        [JsonPropertyName("NATURALIDADE")] public string? Naturalidade { get; set; }
        [JsonPropertyName("ESTADONATAL")] public string? EstadoNatal { get; set; }
        [JsonPropertyName("GRAUINSTRUCAO")] public string? GrauInstrucao { get; set; }
        [JsonPropertyName("NACIONALIDADE")] public string? Nacionalidade { get; set; }
        [JsonPropertyName("CARTIDENTIDADE")] public string? CartIdentidade { get; set; }
        [JsonPropertyName("ORGEMISSORIDENT")] public string? OrgEmissorIdent { get; set; }
        [JsonPropertyName("UFCARTIDENT")] public string? UfCartIdent { get; set; }
        [JsonPropertyName("DTEMISSAOIDENT")] public DateTime? DtEmissaoIdent { get; set; }
        [JsonPropertyName("CARTEIRATRAB")] public string? CarteiraTrab { get; set; }
        [JsonPropertyName("SERIECARTTRAB")] public string? SerieCartTrab { get; set; }
        [JsonPropertyName("UFCARTTRAB")] public string? UfCartTrab { get; set; }
        [JsonPropertyName("DTCARTTRAB")] public DateTime? DtCartTrab { get; set; }
        [JsonPropertyName("NIT")] public string? Nit { get; set; }
        [JsonPropertyName("TITULOELEITOR")] public string? TituloEleitor { get; set; }
        [JsonPropertyName("ZONATITELEITOR")] public string? ZonaTitEleitor { get; set; }
        [JsonPropertyName("SECAOTITELEITOR")] public string? SecaoTitEleitor { get; set; }
        [JsonPropertyName("CERTIFRESERV")] public string? CertifReserv { get; set; }
        [JsonPropertyName("CATEGMILITAR")] public string? CategMilitar { get; set; }
    }

    private sealed record BulkResponse(int Created, int Updated, int Skipped, int Total);
}
