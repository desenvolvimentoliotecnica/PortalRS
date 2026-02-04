using System.Data;
using System.Linq;
using System.Text.Json;
using Liotecnica.Integration.RM.Schema;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Extrai o schema do banco RM (lista de tabelas e colunas) e os dados das tabelas conhecidas.
/// Grava em JSON na pasta Liotecnica.Integration.RM.Schema.Tables para análise.
/// </summary>
public sealed class RmDataExtractor
{
    private readonly ILogger<RmDataExtractor> _logger;
    private readonly RmConnectionOptions _rmOptions;
    private readonly RmSchemaOptions _schemaOptions;
    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;

    public RmDataExtractor(
        ILogger<RmDataExtractor> logger,
        IOptions<RmConnectionOptions> rmOptions,
        IOptions<RmSchemaOptions> schemaOptions,
        IOptions<OutputOptions> outputOptions,
        IHostEnvironment env,
        ExtractionLogWriter logWriter)
    {
        _logger = logger;
        _rmOptions = rmOptions.Value;
        _schemaOptions = schemaOptions.Value;
        _outputOptions = outputOptions.Value;
        _env = env;
        _logWriter = logWriter;
    }

    /// <summary>
    /// Extrai o schema do banco (INFORMATION_SCHEMA: tabelas e colunas) e grava em JSON para análise.
    /// Use isso quando ainda não souber os nomes das tabelas de área, departamento, cargo e vaga.
    /// </summary>
    public async Task ExtractSchemaAsync(CancellationToken ct = default)
    {
        _logWriter.WriteLine("--- Extração de schema iniciada ---");
        var outputDir = GetOutputDirectory();
        Directory.CreateDirectory(outputDir);
        _logWriter.WriteLine($"Destino schema/dados: {outputDir}");
        _logger.LogInformation("Extraindo schema do RM para {Path}", outputDir);

        var connectionString = _rmOptions.GetConnectionString();
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        var tables = await QueryToListAsync(connection,
            "SELECT TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME",
            ct);
        var tablesPath = Path.Combine(outputDir, "schema_tabelas.json");
        await File.WriteAllTextAsync(tablesPath, JsonSerializer.Serialize(tables, new JsonSerializerOptions { WriteIndented = true }), ct);
        _logWriter.WriteLine($"Schema: {tables.Count} tabelas gravadas em schema_tabelas.json");
        _logger.LogInformation("Schema: {Count} tabelas gravadas em {File}", tables.Count, tablesPath);

        var columns = await QueryToListAsync(connection,
            "SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION",
            ct);
        var columnsPath = Path.Combine(outputDir, "schema_colunas.json");
        await File.WriteAllTextAsync(columnsPath, JsonSerializer.Serialize(columns, new JsonSerializerOptions { WriteIndented = true }), ct);
        _logWriter.WriteLine($"Schema: {columns.Count} colunas gravadas em schema_colunas.json");
        _logger.LogInformation("Schema: {Count} colunas gravadas em {File}", columns.Count, columnsPath);
        _logWriter.WriteLine("--- Extração de schema concluída ---");
    }

    /// <summary>
    /// Extrai apenas vagas em aberto da tabela de vagas configurada (VVAGA ou VRSVAGAS).
    /// Filtro: DATAABERTURA &lt;= hoje e (DATAFECHAMENTO IS NULL ou DATAFECHAMENTO &gt;= hoje); para VRSVAGAS também ATIVO = 1 ou 'S'.
    /// Grava em vaga.json na pasta de saída (não altera as outras tabelas).
    /// </summary>
    public async Task ExtractVagasEmAbertoOnlyAsync(CancellationToken ct = default)
    {
        _logWriter.WriteLine("--- Extração de vagas em aberto iniciada ---");
        var outputDir = GetOutputDirectory();
        Directory.CreateDirectory(outputDir);
        var fullTableName = _schemaOptions.FullTableName(_schemaOptions.VagaTable);
        _logger.LogInformation("Extraindo vagas em aberto de {Table} para {Path}", fullTableName, outputDir);

        var connectionString = _rmOptions.GetConnectionString();
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        var hoje = DateTime.Today;
        var isVrsVagas = _schemaOptions.VagaTable.Contains("VRSVAGAS", StringComparison.OrdinalIgnoreCase);
        var sql = $@"SELECT * FROM {fullTableName}
WHERE (DATAABERTURA IS NULL OR TRY_CAST(DATAABERTURA AS DATE) <= @hoje)
  AND (DATAFECHAMENTO IS NULL OR TRY_CAST(DATAFECHAMENTO AS DATE) >= @hoje)";
        if (isVrsVagas)
            sql += " AND (CAST(ATIVO AS VARCHAR(10)) IN ('1', 'S', 's', 'Y', 'y'))";

        var rows = await QueryWithParamsAsync(connection, sql, new Dictionary<string, object> { ["hoje"] = hoje }, ct);
        var path = Path.Combine(outputDir, "vaga.json");
        await File.WriteAllTextAsync(path, JsonSerializer.Serialize(rows, new JsonSerializerOptions { WriteIndented = true }), ct);
        _logWriter.WriteLine($"Vagas em aberto {fullTableName} -> vaga.json: {rows.Count} registros");
        _logger.LogInformation("Vagas em aberto: {Count} registros em {File}", rows.Count, path);
        _logWriter.WriteLine("--- Extração de vagas em aberto concluída ---");
    }

    /// <summary>
    /// Extrai candidatos por vaga (VRS): join VRSVAGAS em aberto + VRSSELECOESVAGASCANDIDATOS + PPESSOA.
    /// Só executa quando a tabela de vagas configurada é VRSVAGAS. Grava em candidato_vaga.json para diagnóstico e futura sincronização.
    /// </summary>
    public async Task ExtractCandidatosPorVagaAsync(CancellationToken ct = default)
    {
        var isVrsVagas = _schemaOptions.VagaTable.Contains("VRSVAGAS", StringComparison.OrdinalIgnoreCase);
        if (!isVrsVagas)
        {
            _logger.LogInformation("ExtractCandidatosPorVaga: ignorado (VagaTable não é VRSVAGAS). Use VRSVAGAS para extrair candidatos por vaga.");
            return;
        }

        _logWriter.WriteLine("--- Extração de candidatos por vaga (VRS) iniciada ---");
        var outputDir = GetOutputDirectory();
        Directory.CreateDirectory(outputDir);

        var vagaTable = _schemaOptions.FullTableName(_schemaOptions.VagaTable);
        var candidatosTable = _schemaOptions.FullTableName("VRSSELECOESVAGASCANDIDATOS");
        var pessoaTable = _schemaOptions.FullTableName(_schemaOptions.PessoaTable);
        _logger.LogInformation("Extraindo candidatos por vaga (VRS) para {Path}", outputDir);

        var hoje = DateTime.Today;
        var sql = $@"
SELECT v.CODCOLIGADA, v.CODVAGA, v.NOME AS NOMEVAGA,
       c.CODPESSOA, c.APROVADO, c.STATUSTRIAGEM, c.CODSELECAO, c.CHAPA,
       p.NOME AS NOMEPESSOA,
       ISNULL(NULLIF(RTRIM(p.EMAIL), ''), NULLIF(RTRIM(p.EMAILPESSOAL), '')) AS EMAIL,
       p.TELEFONE1, p.TELEFONE2, p.CIDADE, p.ESTADO
FROM {vagaTable} v
INNER JOIN {candidatosTable} c ON c.CODVAGA = v.CODVAGA AND c.CODCOLIGADA = v.CODCOLIGADA
INNER JOIN {pessoaTable} p ON p.CODIGO = c.CODPESSOA
WHERE (v.DATAABERTURA IS NULL OR TRY_CAST(v.DATAABERTURA AS DATE) <= @hoje)
  AND (v.DATAFECHAMENTO IS NULL OR TRY_CAST(v.DATAFECHAMENTO AS DATE) >= @hoje)
  AND (CAST(v.ATIVO AS VARCHAR(10)) IN ('1', 'S', 's', 'Y', 'y'))";

        var connectionString = _rmOptions.GetConnectionString();
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        var rows = await QueryWithParamsAsync(connection, sql, new Dictionary<string, object> { ["hoje"] = hoje }, ct);
        var path = Path.Combine(outputDir, "candidato_vaga.json");
        await File.WriteAllTextAsync(path, JsonSerializer.Serialize(rows, new JsonSerializerOptions { WriteIndented = true }), ct);

        var vagasComCandidatos = rows.Select(r => r.TryGetValue("CODVAGA", out var cv) ? cv?.ToString() ?? "" : "").Where(s => !string.IsNullOrEmpty(s)).Distinct().Count();
        _logWriter.WriteLine($"Candidatos por vaga (VRS): {rows.Count} registros em {path}; vagas com candidatos: {vagasComCandidatos}");
        _logger.LogInformation("Candidatos por vaga: {Count} registros em {File}; vagas com candidatos: {VagasCount}", rows.Count, path, vagasComCandidatos);
        _logWriter.WriteLine("--- Extração de candidatos por vaga concluída ---");
    }

    /// <summary>
    /// Extrai perfil de CV (formação, experiência, competências, certificações) por CODPESSOA para os candidatos em candidato_vaga.json.
    /// Grava candidato_perfil.json (CODPESSOA, CvText) para enriquecer o sync no Portal. Só executa quando VagaTable é VRSVAGAS.
    /// </summary>
    public async Task ExtractCandidatoPerfilAsync(CancellationToken ct = default)
    {
        var isVrsVagas = _schemaOptions.VagaTable.Contains("VRSVAGAS", StringComparison.OrdinalIgnoreCase);
        if (!isVrsVagas) return;

        var outputDir = GetOutputDirectory();
        var vagaPath = Path.Combine(outputDir, "candidato_vaga.json");
        if (!File.Exists(vagaPath))
        {
            _logger.LogInformation("ExtractCandidatoPerfil: candidato_vaga.json não encontrado; rode ExtractCandidatosPorVagaAsync antes.");
            return;
        }

        var json = await File.ReadAllTextAsync(vagaPath, ct);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (root.ValueKind != JsonValueKind.Array) return;

        var codPessoas = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in root.EnumerateArray())
        {
            if (!row.TryGetProperty("CODPESSOA", out var el)) continue;
            var cp = el.ValueKind == JsonValueKind.Number ? el.GetRawText() : el.GetString()?.Trim().Trim('"');
            if (!string.IsNullOrEmpty(cp)) codPessoas.Add(cp!);
        }
        if (codPessoas.Count == 0) return;

        _logWriter.WriteLine("--- Extração de perfil CV (formação, experiência, competências, certificações) iniciada ---");
        var inList = string.Join(",", codPessoas.Select(p => "'" + (p ?? "").Replace("'", "''") + "'"));
        var connectionString = _rmOptions.GetConnectionString();
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        var sbByPessoa = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        var formacaoByPessoa = new Dictionary<string, List<Dictionary<string, object?>>>(StringComparer.OrdinalIgnoreCase);
        var experienciasByPessoa = new Dictionary<string, List<Dictionary<string, object?>>>(StringComparer.OrdinalIgnoreCase);
        var competenciasByPessoa = new Dictionary<string, List<Dictionary<string, object?>>>(StringComparer.OrdinalIgnoreCase);
        var treinamentosByPessoa = new Dictionary<string, List<Dictionary<string, object?>>>(StringComparer.OrdinalIgnoreCase);
        foreach (var cp in codPessoas)
        {
            sbByPessoa[cp] = new List<string>();
            formacaoByPessoa[cp] = new List<Dictionary<string, object?>>();
            experienciasByPessoa[cp] = new List<Dictionary<string, object?>>();
            competenciasByPessoa[cp] = new List<Dictionary<string, object?>>();
            treinamentosByPessoa[cp] = new List<Dictionary<string, object?>>();
        }

        try
        {
            var formTable = _schemaOptions.FullTableName("VFORMACAOACAD");
            var formSql = $@"SELECT CODPESSOA, OUTROCURSO, CODCURSO, NOMEENTIDADE, ANOINICIO, ANOTERMINO FROM {formTable} WHERE CODPESSOA IN ({inList})";
            var formRows = await QueryToListAsync(connection, formSql, ct);
            foreach (var r in formRows)
            {
                var cp = GetStr(r, "CODPESSOA");
                if (string.IsNullOrEmpty(cp)) continue;
                var curso = GetStr(r, "OUTROCURSO") ?? GetStr(r, "CODCURSO") ?? "";
                var ent = GetStr(r, "NOMEENTIDADE") ?? "";
                var ai = GetStr(r, "ANOINICIO"); var at = GetStr(r, "ANOTERMINO");
                var periodo = string.IsNullOrEmpty(ai) && string.IsNullOrEmpty(at) ? "" : $" ({ai ?? "?"}-{at ?? "?"})";
                if (sbByPessoa.TryGetValue(cp, out var list))
                    list.Add($"Formação: {curso} - {ent}{periodo}".Trim());
                if (!string.IsNullOrWhiteSpace(curso) && formacaoByPessoa.TryGetValue(cp, out var flist))
                    flist.Add(new Dictionary<string, object?> { ["Curso"] = Trunc(curso, 160), ["Instituicao"] = Trunc(ent, 160), ["Inicio"] = ai, ["Fim"] = at });
            }
        }
        catch (Exception ex) { _logger.LogWarning(ex, "ExtractCandidatoPerfil: VFORMACAOACAD falhou."); }

        try
        {
            var expTable = _schemaOptions.FullTableName("SCVATUACAOPROFISSIONAL");
            var expSql = $@"SELECT CODPESSOA, NOMEINSTITUICAO, CODATUACAOPROF FROM {expTable} WHERE CODPESSOA IN ({inList})";
            var expRows = await QueryToListAsync(connection, expSql, ct);
            foreach (var r in expRows)
            {
                var cp = GetStr(r, "CODPESSOA");
                if (string.IsNullOrEmpty(cp)) continue;
                var inst = GetStr(r, "NOMEINSTITUICAO") ?? "";
                var atu = GetStr(r, "CODATUACAOPROF") ?? "";
                if (sbByPessoa.TryGetValue(cp, out var list))
                    list.Add($"Experiência: {inst} - {atu}".Trim());
                if (experienciasByPessoa.TryGetValue(cp, out var elist))
                    elist.Add(new Dictionary<string, object?> { ["Empresa"] = Trunc(inst, 160), ["Cargo"] = Trunc(atu, 160) });
            }
        }
        catch (Exception ex) { _logger.LogWarning(ex, "ExtractCandidatoPerfil: SCVATUACAOPROFISSIONAL falhou."); }

        try
        {
            var compTable = _schemaOptions.FullTableName("VCOMPETENCIAPESSOA");
            var compSql = $@"SELECT CODPESSOA, CODCOMPETENCIA, OBSERVACAO FROM {compTable} WHERE CODPESSOA IN ({inList})";
            var compRows = await QueryToListAsync(connection, compSql, ct);
            foreach (var r in compRows)
            {
                var cp = GetStr(r, "CODPESSOA");
                if (string.IsNullOrEmpty(cp)) continue;
                var obs = GetStr(r, "OBSERVACAO"); var cod = GetStr(r, "CODCOMPETENCIA");
                var txt = !string.IsNullOrWhiteSpace(obs) ? obs! : (cod ?? "");
                if (!string.IsNullOrWhiteSpace(txt) && sbByPessoa.TryGetValue(cp, out var list))
                    list.Add($"Competência: {txt}".Trim());
                if (!string.IsNullOrWhiteSpace(txt) && competenciasByPessoa.TryGetValue(cp, out var clist))
                    clist.Add(new Dictionary<string, object?> { ["Nome"] = Trunc(txt, 120) });
            }
        }
        catch (Exception ex) { _logger.LogWarning(ex, "ExtractCandidatoPerfil: VCOMPETENCIAPESSOA falhou."); }

        try
        {
            var certTable = _schemaOptions.FullTableName("VCERTIFICACAOPESSOA");
            var certSql = $@"SELECT CODPESSOA, CODCERTIFICACAO FROM {certTable} WHERE CODPESSOA IN ({inList})";
            var certRows = await QueryToListAsync(connection, certSql, ct);
            foreach (var r in certRows)
            {
                var cp = GetStr(r, "CODPESSOA");
                if (string.IsNullOrEmpty(cp)) continue;
                var cert = GetStr(r, "CODCERTIFICACAO") ?? "";
                if (!string.IsNullOrWhiteSpace(cert) && sbByPessoa.TryGetValue(cp, out var list))
                    list.Add($"Certificação: {cert}".Trim());
                if (!string.IsNullOrWhiteSpace(cert) && treinamentosByPessoa.TryGetValue(cp, out var tlist))
                    tlist.Add(new Dictionary<string, object?> { ["Nome"] = Trunc(cert, 160) });
            }
        }
        catch (Exception ex) { _logger.LogWarning(ex, "ExtractCandidatoPerfil: VCERTIFICACAOPESSOA falhou."); }

        var perfilList = new List<Dictionary<string, object?>>();
        foreach (var kv in sbByPessoa)
        {
            var cp = kv.Key;
            var cvText = kv.Value.Count == 0 ? null : string.Join("\n", kv.Value);
            if (string.IsNullOrWhiteSpace(cvText)) cvText = null;
            if (cvText != null && cvText.Length > 8000) cvText = cvText.Substring(0, 8000);
            var hasFormacao = formacaoByPessoa.TryGetValue(cp, out var fl) && fl.Count > 0;
            var hasExp = experienciasByPessoa.TryGetValue(cp, out var el) && el.Count > 0;
            var hasComp = competenciasByPessoa.TryGetValue(cp, out var cl) && cl.Count > 0;
            var hasTrei = treinamentosByPessoa.TryGetValue(cp, out var tl) && tl.Count > 0;
            if (string.IsNullOrWhiteSpace(cvText) && !hasFormacao && !hasExp && !hasComp && !hasTrei) continue;
            var item = new Dictionary<string, object?> { ["CODPESSOA"] = cp, ["CvText"] = cvText };
            if (hasFormacao) item["Formacao"] = fl;
            if (hasExp) item["Experiencias"] = el;
            if (hasComp) item["Competencias"] = cl;
            if (hasTrei) item["Treinamentos"] = tl;
            perfilList.Add(item);
        }

        var path = Path.Combine(outputDir, "candidato_perfil.json");
        await File.WriteAllTextAsync(path, JsonSerializer.Serialize(perfilList, new JsonSerializerOptions { WriteIndented = true }), ct);
        _logWriter.WriteLine($"Perfil CV: {perfilList.Count} pessoas com dados em {path}");
        _logger.LogInformation("Perfil CV: {Count} pessoas com CvText em {File}", perfilList.Count, path);
        _logWriter.WriteLine("--- Extração de perfil CV concluída ---");
    }

    /// <summary>
    /// Extrai currículos (VCURRICULOANEXO.ARQUIVO) do RM, converte e salva na pasta CV/ por CPF da pessoa.
    /// Usa CODPESSOA de candidato_vaga.json; obtém CPF de PPESSOA (CODIGO = CODPESSOA). Grava arquivo binário e opcionalmente JSON com base64 para importação no Portal.
    /// </summary>
    public async Task ExtractCurriculosCvAsync(CancellationToken ct = default)
    {
        var outputDir = GetOutputDirectory();
        var cvRoot = Path.Combine(outputDir, "CV");
        var vagaPath = Path.Combine(outputDir, "candidato_vaga.json");
        if (!File.Exists(vagaPath))
        {
            _logger.LogInformation("ExtractCurriculosCv: candidato_vaga.json não encontrado; rode ExtractCandidatosPorVagaAsync antes.");
            _logWriter.WriteLine("ExtractCurriculosCv: candidato_vaga.json não encontrado.");
            return;
        }

        var json = await File.ReadAllTextAsync(vagaPath, ct);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (root.ValueKind != JsonValueKind.Array) return;

        var codPessoas = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in root.EnumerateArray())
        {
            if (!row.TryGetProperty("CODPESSOA", out var el)) continue;
            var cp = el.ValueKind == JsonValueKind.Number ? el.GetRawText() : el.GetString()?.Trim().Trim('"');
            if (!string.IsNullOrEmpty(cp)) codPessoas.Add(cp!);
        }
        if (codPessoas.Count == 0) return;

        _logWriter.WriteLine("--- Extração de currículos (CV) por CPF iniciada ---");
        _logger.LogInformation("ExtractCurriculosCv: {Count} CODPESSOAs em candidato_vaga; destino CV/ em {Path}", codPessoas.Count, cvRoot);

        var connectionString = _rmOptions.GetConnectionString();
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        var pessoaTable = _schemaOptions.FullTableName(_schemaOptions.PessoaTable);
        var inList = string.Join(",", codPessoas.Select(p => "'" + (p ?? "").Replace("'", "''") + "'"));
        var cpfByCodPessoa = new Dictionary<string, (string? Cpf, string? Nome)>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var sqlPessoa = $@"SELECT CODIGO, CPF, NOME FROM {pessoaTable} WHERE CODIGO IN ({inList})";
            var rowsPessoa = await QueryToListAsync(connection, sqlPessoa, ct);
            foreach (var r in rowsPessoa)
            {
                var cod = GetStr(r, "CODIGO");
                if (string.IsNullOrEmpty(cod)) continue;
                var cpf = GetStr(r, "CPF");
                var nome = GetStr(r, "NOME");
                cpfByCodPessoa[cod] = (cpf, nome);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ExtractCurriculosCv: falha ao ler CPF de {Table}.", pessoaTable);
            _logWriter.WriteLine($"ExtractCurriculosCv: falha ao ler CPF: {ex.Message}");
            return;
        }

        var curriculoTable = _schemaOptions.FullTableName("VCURRICULOANEXO");
        var sqlCurriculo = $@"SELECT ID, CODPESSOA, DESCRICAO, ARQUIVO FROM {curriculoTable} WHERE CODPESSOA IN ({inList}) AND ARQUIVO IS NOT NULL";
        var saved = 0;
        var failed = 0;
        try
        {
            using var cmd = connection.CreateCommand();
            cmd.CommandText = sqlCurriculo;
            cmd.CommandTimeout = 120;
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            var ordCodPessoa = reader.GetOrdinal("CODPESSOA");
            var ordArquivo = reader.GetOrdinal("ARQUIVO");
            var ordId = reader.GetOrdinal("ID");
            var ordDescricao = reader.GetOrdinal("DESCRICAO");

            while (await reader.ReadAsync(ct))
            {
                var codPessoa = reader.IsDBNull(ordCodPessoa) ? null : reader.GetValue(ordCodPessoa)?.ToString()?.Trim();
                if (string.IsNullOrEmpty(codPessoa)) continue;

                byte[]? bytes = null;
                if (!reader.IsDBNull(ordArquivo))
                {
                    if (reader.GetFieldType(ordArquivo) == typeof(byte[]))
                        bytes = (byte[]?)reader.GetValue(ordArquivo);
                    else
                    {
                        using var stream = reader.GetStream(ordArquivo);
                        using var ms = new MemoryStream();
                        await stream.CopyToAsync(ms, ct);
                        bytes = ms.ToArray();
                    }
                }
                if (bytes == null || bytes.Length == 0) continue;

                var id = reader.IsDBNull(ordId) ? "" : reader.GetValue(ordId)?.ToString();
                var descricao = reader.IsDBNull(ordDescricao) ? null : reader.GetValue(ordDescricao)?.ToString()?.Trim();

                var cpfNorm = NormalizeCpfForFolder(cpfByCodPessoa.TryGetValue(codPessoa, out var t) ? t.Cpf : null, codPessoa);
                var pessoaDir = Path.Combine(cvRoot, cpfNorm);
                Directory.CreateDirectory(pessoaDir);

                var extension = DetectPdfExtension(bytes);
                var fileName = "curriculo" + extension;
                var filePath = Path.Combine(pessoaDir, fileName);
                var index = 1;
                while (File.Exists(filePath))
                {
                    fileName = $"curriculo_{index}" + extension;
                    filePath = Path.Combine(pessoaDir, fileName);
                    index++;
                }

                try
                {
                    await File.WriteAllBytesAsync(filePath, bytes, ct);
                    var base64 = Convert.ToBase64String(bytes);
                    var metaPath = Path.Combine(pessoaDir, Path.GetFileNameWithoutExtension(fileName) + ".json");
                    var meta = new Dictionary<string, object?>
                    {
                        ["fileName"] = fileName,
                        ["base64"] = base64,
                        ["codPessoa"] = codPessoa,
                        ["cpf"] = cpfByCodPessoa.TryGetValue(codPessoa, out var x) ? x.Cpf : null,
                        ["nome"] = cpfByCodPessoa.TryGetValue(codPessoa, out var y) ? y.Nome : null,
                        ["idAnexo"] = id,
                        ["descricao"] = descricao,
                        ["sizeBytes"] = bytes.Length
                    };
                    await File.WriteAllTextAsync(metaPath, JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true }), ct);
                    saved++;
                    _logWriter.WriteLine($"CV salvo: {pessoaDir} -> {fileName} ({bytes.Length} bytes)");
                }
                catch (Exception ex)
                {
                    failed++;
                    _logger.LogWarning(ex, "ExtractCurriculosCv: falha ao gravar CV para CODPESSOA {CodPessoa}.", codPessoa);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ExtractCurriculosCv: falha ao ler {Table}.", curriculoTable);
            _logWriter.WriteLine($"ExtractCurriculosCv: falha ao ler anexos: {ex.Message}");
            return;
        }

        _logWriter.WriteLine($"Currículos: {saved} salvos em {cvRoot}, {failed} falhas.");
        _logger.LogInformation("ExtractCurriculosCv: {Saved} currículos em CV/ (por CPF), {Failed} falhas.", saved, failed);
        _logWriter.WriteLine("--- Extração de currículos (CV) concluída ---");
    }

    private static string NormalizeCpfForFolder(string? cpf, string codPessoa)
    {
        if (!string.IsNullOrWhiteSpace(cpf))
        {
            var digits = new string(cpf.Where(char.IsDigit).ToArray());
            if (digits.Length >= 11)
                return digits;
        }
        return "SEM_CPF_" + codPessoa;
    }

    private static string DetectPdfExtension(byte[] bytes)
    {
        if (bytes.Length >= 5 && bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46)
            return ".pdf";
        if (bytes.Length >= 2 && bytes[0] == 0xD0 && bytes[1] == 0xCF)
            return ".doc";
        return ".pdf";
    }

    private static string? GetStr(Dictionary<string, object?> r, string key)
    {
        if (!r.TryGetValue(key, out var v) || v == null) return null;
        var s = v.ToString()?.Trim();
        return string.IsNullOrEmpty(s) ? null : s;
    }

    private static string Trunc(string? value, int maxLen)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        return value!.Length <= maxLen ? value : value.Substring(0, maxLen);
    }

    /// <summary>
    /// Conecta ao RM, lê cada tabela (SELECT *) e grava um JSON por tabela na pasta de saída.
    /// </summary>
    public async Task ExtractAndSaveAsync(CancellationToken ct = default)
    {
        _logWriter.WriteLine("--- Extração de dados das tabelas iniciada ---");
        var outputDir = GetOutputDirectory();
        Directory.CreateDirectory(outputDir);
        _logger.LogInformation("Extraindo dados do RM para {Path}", outputDir);

        var tables = new[]
        {
            (_schemaOptions.FullTableName(_schemaOptions.AreaTable), "area"),
            (_schemaOptions.FullTableName(_schemaOptions.DepartamentoTable), "departamento"),
            (_schemaOptions.FullTableName(_schemaOptions.FuncaoTable), "funcao"),
            (_schemaOptions.FullTableName(_schemaOptions.CargoTable), "cargo"),
            (_schemaOptions.FullTableName(_schemaOptions.VagaTable), "vaga"),
            (_schemaOptions.FullTableName(_schemaOptions.UnidadeTable), "unidade"),
            (_schemaOptions.FullTableName(_schemaOptions.FuncionarioTable), "funcionario"),
            (_schemaOptions.FullTableName(_schemaOptions.PessoaTable), "pessoa")
        };

        var connectionString = _rmOptions.GetConnectionString();
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);

        foreach (var (fullTableName, fileName) in tables)
        {
            try
            {
                var rows = await ReadTableAsync(connection, fullTableName, ct);
                var path = Path.Combine(outputDir, $"{fileName}.json");
                await File.WriteAllTextAsync(path, JsonSerializer.Serialize(rows, new JsonSerializerOptions { WriteIndented = true }), ct);
                _logWriter.WriteLine($"Tabela {fullTableName} -> {fileName}.json: {rows.Count} registros");
                _logger.LogInformation("Tabela {Table}: {Count} registros gravados em {File}", fullTableName, rows.Count, path);
            }
            catch (Exception ex)
            {
                _logWriter.WriteLine($"Tabela {fullTableName}: ERRO - {ex.Message}");
                _logger.LogWarning(ex, "Falha ao extrair tabela {Table}", fullTableName);
            }
        }
        _logWriter.WriteLine("--- Extração de dados concluída ---");
    }

    private static async Task<List<Dictionary<string, object?>>> QueryToListAsync(SqlConnection connection, string sql, CancellationToken ct)
    {
        var rows = new List<Dictionary<string, object?>>();
        var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        cmd.CommandTimeout = 60;
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var row = new Dictionary<string, object?>();
            for (var i = 0; i < reader.FieldCount; i++)
            {
                var name = reader.GetName(i);
                var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                row[name] = value;
            }
            rows.Add(row);
        }
        return rows;
    }

    private static async Task<List<Dictionary<string, object?>>> QueryWithParamsAsync(
        SqlConnection connection,
        string sql,
        IReadOnlyDictionary<string, object> parameters,
        CancellationToken ct)
    {
        var rows = new List<Dictionary<string, object?>>();
        var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        cmd.CommandTimeout = 120;
        foreach (var kv in parameters)
            cmd.Parameters.AddWithValue("@" + kv.Key, kv.Value ?? DBNull.Value);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var row = new Dictionary<string, object?>();
            for (var i = 0; i < reader.FieldCount; i++)
            {
                var name = reader.GetName(i);
                var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                row[name] = value;
            }
            rows.Add(row);
        }
        return rows;
    }

    private async Task<List<Dictionary<string, object?>>> ReadTableAsync(SqlConnection connection, string fullTableName, CancellationToken ct)
    {
        var rows = new List<Dictionary<string, object?>>();
        var cmd = connection.CreateCommand();
        cmd.CommandText = $"SELECT * FROM {fullTableName}";
        cmd.CommandTimeout = 120;
        await using var reader = await cmd.ExecuteReaderAsync(ct);

        while (await reader.ReadAsync(ct))
        {
            var row = new Dictionary<string, object?>();
            for (var i = 0; i < reader.FieldCount; i++)
            {
                var name = reader.GetName(i);
                var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                row[name] = value;
            }
            rows.Add(row);
        }

        return rows;
    }

    private string GetOutputDirectory()
    {
        var path = _outputOptions.SchemaTablesPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            return Path.IsPathRooted(path) ? path : Path.GetFullPath(path);

        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }
}
