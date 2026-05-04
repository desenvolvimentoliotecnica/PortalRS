using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Sincroniza funcionários do TOTVS RM (<c>dbo.PFUNC</c>) para a API do Portal
/// (<c>POST /api/funcionarios/sync-rm/bulk</c>).
///
/// Fluxo (refactor 2026-04-26 — substituiu o fallback antigo PPESSOA→Funcionário):
/// 1. Lê <c>funcionario.json</c> (= PFUNC) — fonte autoritativa de funcionários TOTVS Liotécnica.
/// 2. Filtra apenas <c>CODSITUACAO IN ('A','F','P')</c> (~637 ativos de 5314).
/// 3. JOIN in-memory com <c>pessoa.json</c> (PPESSOA) via <c>CODPESSOA</c> pra obter
///    nome real, e-mail real, CPF, telefone, data de nascimento.
/// 4. JOIN in-memory com <c>funcao.json</c> (PFUNCAO) pra resolver
///    <c>PFUNC.CODFUNCAO → PFUNCAO.CARGO</c> (= código do PCARGO no Portal).
/// 5. JOIN in-memory com <c>transf_promocao.json</c> (VREQTRANSFPROMOCAO) pra obter
///    a última hierarquia destino aprovada por CHAPA (38% dos ativos têm).
/// 6. JOIN com <c>pfunc_lider_hrplatform.json</c> (<c>PFUNCLIDERHRPLATFORM</c>): <c>CHAPALIDER</c> do líder
///    principal (<c>MASTER=1</c> quando existir) → campo <c>chapaGestorDireto</c> no bulk (Portal grava <c>GestorDiretoId</c>).
/// 7. Fallback quando (6) não cobre: <c>view_pfunc_hierarquia.json</c> (<c>VWPFUNCHIERARQUIA.CODUSUARIOCHEFE</c>) +
///    <c>gusuario.json</c> (<c>GUSUARIO</c>) + e-mail em <c>pessoa.json</c> → chapa do gestor em <c>funcionario.json</c>.
///    Registros de (6) têm prioridade sobre o fallback. Se a view tiver mais de um <c>CODUSUARIOCHEFE</c> por
///    funcionário, usa o <b>menor</b> login (ordinal, case-insensitive) que resolva para chapa — desempate estável.
/// 8. Envia bulk com chaves crus (códigos RM) — endpoint resolve FKs internamente.
/// </summary>
public sealed class PortalFuncionarioSyncService
{
    private readonly ILogger<PortalFuncionarioSyncService> _logger;
    private readonly PortalApiClient _portalClient;
    private readonly OutputOptions _outputOptions;
    private readonly IHostEnvironment _env;
    private readonly ExtractionLogWriter _logWriter;
    private readonly RmSyncOptions _syncOptions;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
        Converters = { new NumberOrStringConverter() },
    };

    /// <summary>Serialização do bulk de funcionários: omite <c>null</c> para o Portal não interpretar como "limpar gestor".</summary>
    private static readonly JsonSerializerOptions BulkPostJsonOptions = new(JsonOptions)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>Lê string ou número e devolve como string. PPESSOA tem NIT/TITULOELEITOR/etc como number puro.</summary>
    private sealed class NumberOrStringConverter : JsonConverter<string?>
    {
        public override string? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
            reader.TokenType switch
            {
                JsonTokenType.String => reader.GetString(),
                JsonTokenType.Number => reader.TryGetInt64(out var l) ? l.ToString() : reader.GetDecimal().ToString(System.Globalization.CultureInfo.InvariantCulture),
                JsonTokenType.Null => null,
                JsonTokenType.True => "true",
                JsonTokenType.False => "false",
                _ => reader.GetString(),
            };
        public override void Write(Utf8JsonWriter writer, string? value, JsonSerializerOptions options)
        {
            if (value is null) writer.WriteNullValue();
            else writer.WriteStringValue(value);
        }
    }

    public PortalFuncionarioSyncService(
        ILogger<PortalFuncionarioSyncService> logger,
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

    public async Task SyncFuncionariosFromFuncionarioJsonAsync(CancellationToken ct = default)
    {
        try { await SyncCoreAsync(ct); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Funcionários: falha geral.");
            _logWriter.WriteLine($"Sync Funcionários: falha geral - {ex.Message}");
        }
    }

    private async Task SyncCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var pfuncFile = Path.Combine(path, "funcionario.json");
        if (!File.Exists(pfuncFile))
        {
            _logWriter.WriteLine("Sync Funcionários: funcionario.json não encontrado; pulando.");
            return;
        }

        var pfuncJson = await File.ReadAllTextAsync(pfuncFile, ct);
        var pfuncRows = JsonSerializer.Deserialize<List<PfuncRow>>(pfuncJson, JsonOptions);
        if (pfuncRows is null || pfuncRows.Count == 0)
        {
            _logWriter.WriteLine("Sync Funcionários: PFUNC vazio.");
            return;
        }

        var pessoaByCodigo = await LoadPessoaLookupAsync(path, ct);
        var pfuncaoCargoByCodigo = await LoadPfuncaoCargoLookupAsync(path, ct);
        var pfuncaoNomeByCodigo = await LoadPfuncaoNomeLookupAsync(path, ct);
        var ultimaHierarquiaByChapa = await LoadUltimaHierarquiaPorChapaAsync(path, ct);
        var chapaGestorPorColigadaEChapa = await MergeGestorDiretoMapsAsync(
            path,
            pfuncRows,
            pessoaByCodigo,
            ct);

        // 2026-04-26: trazemos TODOS os PFUNC (ativos + desligados/inativos) pra:
        //   - Vincular Desligamento.FuncionarioId mesmo de quem saiu (CODSITUACAO=D)
        //   - Permitir histórico/auditoria
        // O endpoint sync-rm/bulk recebe codSituacao e mapeia pra Funcionario.Status:
        //   A,F,P → Active(1)  |  D,I,outros → Inactive(2)
        // Tela de Funcionários filtra Active por default; toggle pra mostrar inativos.
        // Dedup por CHAPA — TOTVS pode ter PFUNC duplicado em schemas TOTVSAUDIT.
        // Quando há mais de 1, preferimos o registro ativo (CODSITUACAO IN A,F,P).
        var todos = pfuncRows
            .Where(r => !string.IsNullOrWhiteSpace(r.Chapa))
            .GroupBy(r => r.Chapa!.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(g => g.OrderByDescending(r => new[] { "A", "F", "P" }.Contains((r.CodSituacao ?? "").Trim().ToUpperInvariant())).First())
            .ToList();
        var ativosCount = todos.Count(r => new[] { "A", "F", "P" }.Contains((r.CodSituacao ?? "").Trim().ToUpperInvariant()));
        _logWriter.WriteLine($"Sync Funcionários: PFUNC total={pfuncRows.Count}, com chapa={todos.Count}, ativos={ativosCount}, inativos={todos.Count - ativosCount}");

        var items = todos.Select(r =>
        {
            var pessoa = r.CodPessoa.HasValue && pessoaByCodigo.TryGetValue(r.CodPessoa.Value, out var p) ? p : null;

            string? codCargo = null;
            if (!string.IsNullOrWhiteSpace(r.CodFuncao) && pfuncaoCargoByCodigo.TryGetValue(r.CodFuncao.Trim(), out var pc))
                codCargo = PortalCargoSyncService.ToPortalJobCode(pc);

            int? idHierarquiaDestino = null;
            if (ultimaHierarquiaByChapa.TryGetValue(r.Chapa!.Trim(), out var hier))
                idHierarquiaDestino = hier;

            var colFunc = r.CodColigada ?? 1;
            var chapaGestorDireto = chapaGestorPorColigadaEChapa.TryGetValue($"{colFunc}|{r.Chapa!.Trim()}", out var gl)
                ? gl
                : null;

            var nome = (pessoa?.Nome ?? "").Trim();
            if (nome.Length > 160) nome = nome.Substring(0, 160);

            return new
            {
                chapa = r.Chapa.Trim(),
                nome = string.IsNullOrEmpty(nome) ? "(sem nome)" : nome,
                email = string.IsNullOrWhiteSpace(pessoa?.Email) ? null : pessoa!.Email!.Trim().ToLowerInvariant(),
                cpf = string.IsNullOrWhiteSpace(pessoa?.Cpf) ? null : pessoa!.Cpf!.Trim(),
                telefone = pessoa?.Telefone1?.Trim(),
                dataAdmissao = r.DataAdmissao.HasValue ? DateOnly.FromDateTime(r.DataAdmissao.Value) : (DateOnly?)null,
                dataNascimento = pessoa?.DtNascimento.HasValue == true ? DateOnly.FromDateTime(pessoa.DtNascimento.Value) : (DateOnly?)null,
                codSituacao = r.CodSituacao,
                codSecao = r.CodSecao,
                codFuncao = r.CodFuncao,
                codCargo,
                funcaoNome = !string.IsNullOrWhiteSpace(r.CodFuncao) && pfuncaoNomeByCodigo.TryGetValue(r.CodFuncao.Trim(), out var fn) ? fn : null,
                codFilial = r.CodFilial,
                idHierarquiaDestinoRm = idHierarquiaDestino,
                codPessoa = r.CodPessoa,
                codColigada = r.CodColigada,
                chapaGestorDireto = chapaGestorDireto,
                // ── LUC-122: cadastro pessoal completo de PPESSOA ─────────
                apelido = pessoa?.Apelido?.Trim(),
                sexo = pessoa?.Sexo?.Trim(),
                estadoCivil = pessoa?.EstadoCivil?.Trim(),
                naturalidade = pessoa?.Naturalidade?.Trim(),
                estadoNatal = pessoa?.EstadoNatal?.Trim(),
                grauInstrucao = pessoa?.GrauInstrucao?.Trim(),
                cep = pessoa?.Cep?.Trim(),
                logradouro = pessoa?.Rua?.Trim(),
                numeroEndereco = pessoa?.Numero?.Trim(),
                complemento = pessoa?.Complemento?.Trim(),
                bairro = pessoa?.Bairro?.Trim(),
                cidade = pessoa?.Cidade?.Trim(),
                uf = pessoa?.Estado?.Trim(),
                rg = pessoa?.CartIdentidade?.Trim(),
                rgOrgEmissor = pessoa?.OrgEmissorIdent?.Trim(),
                rgUf = pessoa?.UfCartIdent?.Trim(),
                rgDataEmissao = pessoa?.DtEmissaoIdent,
                carteiraTrabalho = pessoa?.CarteiraTrab?.Trim(),
                carteiraTrabalhoSerie = pessoa?.SerieCartTrab?.Trim(),
                carteiraTrabalhoUf = pessoa?.UfCartTrab?.Trim(),
                carteiraTrabalhoData = pessoa?.DtCartTrab,
                numeroPis = pessoa?.Nit?.Trim(),
                tituloEleitor = pessoa?.TituloEleitor?.Trim(),
                tituloEleitorZona = pessoa?.ZonaTitEleitor?.Trim(),
                tituloEleitorSecao = pessoa?.SecaoTitEleitor?.Trim(),
                certificadoReservista = pessoa?.CertifReserv?.Trim(),
                categoriaMilitar = pessoa?.CategMilitar?.Trim(),
                // PPESSOA.NACIONALIDADE ("10" = Brasileira). Worker envia o código; UI pode mapear.
                nacionalidade = pessoa?.Nacionalidade?.Trim(),
            };
        }).ToList();

        // Cap dedicado pra funcionários (sem confundir com MaxPessoasToSync que é só pra PPESSOA bulk).
        // Default null = sem cap (envia todos os ~637 ativos).
        if (_syncOptions.MaxFuncionariosToSync is int cap && cap > 0 && items.Count > cap)
        {
            _logWriter.WriteLine($"Sync Funcionários: limitando envio a {cap} (de {items.Count}) via RmSync:MaxFuncionariosToSync.");
            items = items.Take(cap).ToList();
        }

        var body = new { items };
        _logWriter.WriteLine($"Sync Funcionários: enviando {items.Count} funcionários ativos para api/funcionarios/sync-rm/bulk");

        var resp = await _portalClient.Http.PostAsJsonAsync("api/funcionarios/sync-rm/bulk", body, BulkPostJsonOptions, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var msg = await resp.Content.ReadAsStringAsync(ct);
            _logWriter.WriteLine($"Sync Funcionários: ERRO {resp.StatusCode}: {msg}");
            _logger.LogWarning("POST api/funcionarios/sync-rm/bulk falhou: {Status} {Msg}", resp.StatusCode, msg);
            return;
        }

        var result = await resp.Content.ReadFromJsonAsync<BulkResponse>(JsonOptions, ct);
        _logWriter.WriteLine($"Sync Funcionários: OK — criados={result?.Created ?? 0}, atualizados={result?.Updated ?? 0}, pulados ativos={result?.Skipped ?? 0}, pulados inativos={result?.SkippedInactive ?? 0}, total enviado={result?.Total ?? 0}");
        _logger.LogInformation("Sync Funcionários: criados={Created}, atualizados={Updated}, totalAtivos={TotalAtivos}",
            result?.Created ?? 0, result?.Updated ?? 0, result?.Total ?? 0);
    }

    private async Task<Dictionary<int, PessoaRow>> LoadPessoaLookupAsync(string path, CancellationToken ct)
    {
        var file = Path.Combine(path, "pessoa.json");
        if (!File.Exists(file)) return new();
        var json = await File.ReadAllTextAsync(file, ct);
        var rows = JsonSerializer.Deserialize<List<PessoaRow>>(json, JsonOptions) ?? new();
        return rows.Where(p => p.Codigo.HasValue).ToDictionary(p => p.Codigo!.Value, p => p);
    }

    private async Task<Dictionary<string, string>> LoadPfuncaoCargoLookupAsync(string path, CancellationToken ct)
    {
        var file = Path.Combine(path, "funcao.json");
        if (!File.Exists(file)) return new(StringComparer.OrdinalIgnoreCase);
        var json = await File.ReadAllTextAsync(file, ct);
        var rows = JsonSerializer.Deserialize<List<PfuncaoRow>>(json, JsonOptions) ?? new();
        return rows
            .Where(r => !string.IsNullOrWhiteSpace(r.Codigo) && !string.IsNullOrWhiteSpace(r.Cargo))
            .GroupBy(r => r.Codigo!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().Cargo!.Trim(), StringComparer.OrdinalIgnoreCase);
    }

    private async Task<Dictionary<string, string>> LoadPfuncaoNomeLookupAsync(string path, CancellationToken ct)
    {
        var file = Path.Combine(path, "funcao.json");
        if (!File.Exists(file)) return new(StringComparer.OrdinalIgnoreCase);
        var json = await File.ReadAllTextAsync(file, ct);
        var rows = JsonSerializer.Deserialize<List<PfuncaoRow>>(json, JsonOptions) ?? new();
        // PFUNCAO duplica por CODCOLIGADA (1 e 2). Coligada 2 costuma ter o nome completo
        // ("ANALISTA DE PRICING SR"), coligada 1 tem versão curta ("ANL PRICING SR").
        // Pega sempre o mais longo pra exibição mais clara.
        return rows
            .Where(r => !string.IsNullOrWhiteSpace(r.Codigo) && !string.IsNullOrWhiteSpace(r.Nome))
            .GroupBy(r => r.Codigo!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Nome!.Length).First().Nome!.Trim(), StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Lê <c>pfunc_lider_hrplatform.json</c> (PFUNCLIDERHRPLATFORM): CHAPA → CHAPALIDER do líder principal (<c>MASTER=1</c> quando existir).
    /// Chave: <c>"{CODCOLIGADA}|{CHAPA}"</c> alinhada ao PFUNC do mesmo funcionário.
    /// </summary>
    private static async Task<Dictionary<string, string>> LoadChapaGestorDiretoPorColigadaEChapaAsync(string path, CancellationToken ct)
    {
        var file = Path.Combine(path, "pfunc_lider_hrplatform.json");
        if (!File.Exists(file))
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var json = await File.ReadAllTextAsync(file, ct);
        var rows = JsonSerializer.Deserialize<List<PfuncLiderHrPlatformRow>>(json, JsonOptions) ?? new();
        // Por (coligada, chapa func): preferir MASTER=1; senão qualquer linha com CHAPALIDER válido.
        var bestLider = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var bestPrio = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.Chapa) || string.IsNullOrWhiteSpace(row.ChapaLider))
                continue;
            var chf = row.Chapa.Trim();
            var lid = row.ChapaLider.Trim();
            if (chf.Equals(lid, StringComparison.OrdinalIgnoreCase))
                continue;

            var col = row.CodColigada ?? 1;
            var key = $"{col}|{chf}";
            var prio = row.IsMasterPrincipal ? 2 : 1;
            if (!bestLider.TryGetValue(key, out _))
            {
                bestLider[key] = lid;
                bestPrio[key] = prio;
            }
            else if (prio > bestPrio[key])
            {
                bestLider[key] = lid;
                bestPrio[key] = prio;
            }
        }

        return bestLider;
    }

    /// <summary>
    /// Mescla gestor direto: <c>PFUNCLIDERHRPLATFORM</c> (prioridade) + fallback
    /// <c>VWPFUNCHIERARQUIA.CODUSUARIOCHEFE</c> resolvido via <c>GUSUARIO</c> + e-mail <c>PPESSOA</c> + <c>PFUNC</c>.
    /// </summary>
    private async Task<Dictionary<string, string>> MergeGestorDiretoMapsAsync(
        string path,
        List<PfuncRow> todasPfuncRows,
        Dictionary<int, PessoaRow> pessoaByCodigo,
        CancellationToken ct)
    {
        var fromHrPlatform = await LoadChapaGestorDiretoPorColigadaEChapaAsync(path, ct);
        var fromViewUsuario = await LoadChapaGestorDiretoViaViewUsuarioChefeAsync(path, todasPfuncRows, pessoaByCodigo, ct);

        var merged = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var kv in fromViewUsuario)
            merged[kv.Key] = kv.Value;
        foreach (var kv in fromHrPlatform)
            merged[kv.Key] = kv.Value;

        if (fromViewUsuario.Count > 0 || fromHrPlatform.Count > 0)
            _logWriter.WriteLine($"Gestor direto: PFUNCLIDERHRPLATFORM={fromHrPlatform.Count} chaves; fallback VWPFUNCHIERARQUIA+GUSUARIO={fromViewUsuario.Count} chaves (HR Platform sobrescreve em empate). Total mesclado={merged.Count}.");

        return merged;
    }

    /// <summary>
    /// Fallback quando <c>PFUNCLIDERHRPLATFORM</c> está vazio/incompleto: usa <c>CODUSUARIOCHEFE</c> na view,
    /// amarra a <c>GUSUARIO</c> por login, <c>PPESSOA</c> por e-mail e <c>PFUNC</c> para obter a chapa do chefe
    /// (apenas vínculos com <c>CODSITUACAO</c> ativo A/F/P no cadastro do gestor).
    /// </summary>
    private static async Task<Dictionary<string, string>> LoadChapaGestorDiretoViaViewUsuarioChefeAsync(
        string path,
        List<PfuncRow> todasPfuncRows,
        Dictionary<int, PessoaRow> pessoaByCodigo,
        CancellationToken ct)
    {
        var gusuFile = Path.Combine(path, "gusuario.json");
        var viewFile = Path.Combine(path, "view_pfunc_hierarquia.json");
        if (!File.Exists(gusuFile) || !File.Exists(viewFile))
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var gusuJson = await File.ReadAllTextAsync(gusuFile, ct);
        var gusuRows = JsonSerializer.Deserialize<List<GUsuarioRow>>(gusuJson, JsonOptions) ?? new();
        if (gusuRows.Count == 0)
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var emailNormToCodPessoa = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var p in pessoaByCodigo.Values)
        {
            if (p.Codigo is null || string.IsNullOrWhiteSpace(p.Email)) continue;
            var k = NormalizeEmailKey(p.Email);
            if (k.Length == 0) continue;
            if (!emailNormToCodPessoa.ContainsKey(k))
                emailNormToCodPessoa[k] = p.Codigo.Value;
        }

        // (codColigada|codUsuarioNormalizado) -> chapa do gestor no PFUNC
        var chapaGestorPorColigadaEUsuario = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var gu in gusuRows)
        {
            if (string.IsNullOrWhiteSpace(gu.CodUsuario) || string.IsNullOrWhiteSpace(gu.Email)) continue;
            if (!emailNormToCodPessoa.TryGetValue(NormalizeEmailKey(gu.Email), out var codPessoa)) continue;
            var uKey = NormalizeUsuarioKey(gu.CodUsuario);
            if (uKey.Length == 0) continue;

            foreach (var pf in todasPfuncRows)
            {
                if (pf.CodPessoa != codPessoa || string.IsNullOrWhiteSpace(pf.Chapa)) continue;
                var sit = (pf.CodSituacao ?? "").Trim().ToUpperInvariant();
                if (sit is not ("A" or "F" or "P")) continue;
                var col = pf.CodColigada ?? 1;
                var mapKey = $"{col}|{uKey}";
                chapaGestorPorColigadaEUsuario[mapKey] = pf.Chapa.Trim();
            }
        }

        if (chapaGestorPorColigadaEUsuario.Count == 0)
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var viewJson = await File.ReadAllTextAsync(viewFile, ct);
        var viewRows = JsonSerializer.Deserialize<List<ViewPfuncHierarquiaGestorRow>>(viewJson, JsonOptions) ?? new();

        // VWPFUNCHIERARQUIA pode devolver 2+ linhas por (coligada,chapa) com CODUSUARIOCHEFE distintos.
        // Ordena pelo login do chefe e grava só a primeira resolução válida → menor CODUSUARIOCHEFE (case-insensitive).
        var viewOrdered = viewRows
            .Where(r => !string.IsNullOrWhiteSpace(r.Chapa) && !string.IsNullOrWhiteSpace(r.CodUsuarioChefe))
            .OrderBy(r => r.CodColigada ?? 0)
            .ThenBy(r => r.Chapa!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ThenBy(r => NormalizeUsuarioKey(r.CodUsuarioChefe), StringComparer.OrdinalIgnoreCase);

        var resultado = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in viewOrdered)
        {
            var empChapa = row.Chapa!.Trim();

            var col = row.CodColigada ?? 1;
            var uChef = NormalizeUsuarioKey(row.CodUsuarioChefe);
            if (uChef.Length == 0) continue;

            if (!chapaGestorPorColigadaEUsuario.TryGetValue($"{col}|{uChef}", out var chapaGestor))
                continue;

            if (chapaGestor.Equals(empChapa, StringComparison.OrdinalIgnoreCase))
                continue;

            var empKey = $"{col}|{empChapa}";
            if (resultado.ContainsKey(empKey))
                continue;

            resultado[empKey] = chapaGestor;
        }

        return resultado;
    }

    private static string NormalizeEmailKey(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return string.Empty;
        return email.Trim().ToLowerInvariant();
    }

    private static string NormalizeUsuarioKey(string? codUsuario)
    {
        if (string.IsNullOrWhiteSpace(codUsuario)) return string.Empty;
        return codUsuario.Trim().ToLowerInvariant();
    }

    private async Task<Dictionary<string, int>> LoadUltimaHierarquiaPorChapaAsync(string path, CancellationToken ct)
    {
        var file = Path.Combine(path, "transf_promocao.json");
        if (!File.Exists(file)) return new(StringComparer.OrdinalIgnoreCase);
        var json = await File.ReadAllTextAsync(file, ct);
        var rows = JsonSerializer.Deserialize<List<TransfPromocaoRow>>(json, JsonOptions) ?? new();
        return rows
            .Where(r => !string.IsNullOrWhiteSpace(r.Chapa)
                        && r.IdHierarquiaDestino.HasValue
                        && r.CodStatus == 4)
            .GroupBy(r => r.Chapa!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(x => x.DataConclusao ?? DateTime.MinValue).First().IdHierarquiaDestino!.Value,
                StringComparer.OrdinalIgnoreCase);
    }

    private string GetSchemaTablesPath()
    {
        var path = _outputOptions.SchemaTablesPath?.Trim();
        if (!string.IsNullOrEmpty(path))
            return Path.IsPathRooted(path) ? path : Path.GetFullPath(path);
        var contentRoot = _env.ContentRootPath ?? AppContext.BaseDirectory;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "Liotecnica.Integration.RM.Schema.Tables"));
    }

    /// <summary>Mínimo de <c>GUSUARIO</c> para resolver chefe → chapa via e-mail.</summary>
    private sealed class GUsuarioRow
    {
        [JsonPropertyName("CODUSUARIO")]
        public string? CodUsuario { get; set; }

        [JsonPropertyName("EMAIL")]
        public string? Email { get; set; }
    }

    /// <summary>Colunas necessárias de <c>VWPFUNCHIERARQUIA</c> para o fallback de gestor.</summary>
    private sealed class ViewPfuncHierarquiaGestorRow
    {
        [JsonPropertyName("CODCOLIGADA")]
        public int? CodColigada { get; set; }

        [JsonPropertyName("CHAPA")]
        public string? Chapa { get; set; }

        [JsonPropertyName("CODUSUARIOCHEFE")]
        public string? CodUsuarioChefe { get; set; }
    }

    private sealed class PfuncLiderHrPlatformRow
    {
        [JsonPropertyName("CODCOLIGADA")]
        public int? CodColigada { get; set; }

        [JsonPropertyName("CHAPA")]
        public string? Chapa { get; set; }

        [JsonPropertyName("CHAPALIDER")]
        public string? ChapaLider { get; set; }

        /// <summary>1 = líder principal quando há vários vínculos (RM <c>SMALLINT</c>).</summary>
        [JsonPropertyName("MASTER")]
        public int? Master { get; set; }

        public bool IsMasterPrincipal => Master == 1;
    }

    private sealed class PfuncRow
    {
        [JsonPropertyName("CHAPA")]
        public string? Chapa { get; set; }
        [JsonPropertyName("CODPESSOA")]
        public int? CodPessoa { get; set; }
        [JsonPropertyName("CODCOLIGADA")]
        public int? CodColigada { get; set; }
        [JsonPropertyName("CODSECAO")]
        public string? CodSecao { get; set; }
        [JsonPropertyName("CODFUNCAO")]
        public string? CodFuncao { get; set; }
        [JsonPropertyName("CODFILIAL")]
        public int? CodFilial { get; set; }
        [JsonPropertyName("CODSITUACAO")]
        public string? CodSituacao { get; set; }
        [JsonPropertyName("DATAADMISSAO")]
        public DateTime? DataAdmissao { get; set; }
    }

    private sealed class PessoaRow
    {
        [JsonPropertyName("CODIGO")]
        public int? Codigo { get; set; }
        [JsonPropertyName("NOME")]
        public string? Nome { get; set; }
        [JsonPropertyName("APELIDO")]
        public string? Apelido { get; set; }
        [JsonPropertyName("CPF")]
        public string? Cpf { get; set; }
        [JsonPropertyName("EMAIL")]
        public string? Email { get; set; }
        [JsonPropertyName("TELEFONE1")]
        public string? Telefone1 { get; set; }
        [JsonPropertyName("DTNASCIMENTO")]
        public DateTime? DtNascimento { get; set; }
        // Pessoal
        [JsonPropertyName("SEXO")]
        public string? Sexo { get; set; }
        [JsonPropertyName("ESTADOCIVIL")]
        public string? EstadoCivil { get; set; }
        [JsonPropertyName("NATURALIDADE")]
        public string? Naturalidade { get; set; }
        [JsonPropertyName("ESTADONATAL")]
        public string? EstadoNatal { get; set; }
        [JsonPropertyName("GRAUINSTRUCAO")]
        public string? GrauInstrucao { get; set; }
        // Endereço
        [JsonPropertyName("CEP")]
        public string? Cep { get; set; }
        [JsonPropertyName("RUA")]
        public string? Rua { get; set; }
        [JsonPropertyName("NUMERO")]
        public string? Numero { get; set; }
        [JsonPropertyName("COMPLEMENTO")]
        public string? Complemento { get; set; }
        [JsonPropertyName("BAIRRO")]
        public string? Bairro { get; set; }
        [JsonPropertyName("CIDADE")]
        public string? Cidade { get; set; }
        [JsonPropertyName("ESTADO")]
        public string? Estado { get; set; }
        // RG
        [JsonPropertyName("CARTIDENTIDADE")]
        public string? CartIdentidade { get; set; }
        [JsonPropertyName("ORGEMISSORIDENT")]
        public string? OrgEmissorIdent { get; set; }
        [JsonPropertyName("UFCARTIDENT")]
        public string? UfCartIdent { get; set; }
        [JsonPropertyName("DTEMISSAOIDENT")]
        public DateTime? DtEmissaoIdent { get; set; }
        // CTPS
        [JsonPropertyName("CARTEIRATRAB")]
        public string? CarteiraTrab { get; set; }
        [JsonPropertyName("SERIECARTTRAB")]
        public string? SerieCartTrab { get; set; }
        [JsonPropertyName("UFCARTTRAB")]
        public string? UfCartTrab { get; set; }
        [JsonPropertyName("DTCARTTRAB")]
        public DateTime? DtCartTrab { get; set; }
        // PIS
        [JsonPropertyName("NIT")]
        public string? Nit { get; set; }
        // Título eleitor
        [JsonPropertyName("TITULOELEITOR")]
        public string? TituloEleitor { get; set; }
        [JsonPropertyName("ZONATITELEITOR")]
        public string? ZonaTitEleitor { get; set; }
        [JsonPropertyName("SECAOTITELEITOR")]
        public string? SecaoTitEleitor { get; set; }
        // Reservista
        [JsonPropertyName("CERTIFRESERV")]
        public string? CertifReserv { get; set; }
        [JsonPropertyName("CATEGMILITAR")]
        public string? CategMilitar { get; set; }
        // Nacionalidade (código TOTVS, ex.: "10" = Brasileira).
        [JsonPropertyName("NACIONALIDADE")]
        public string? Nacionalidade { get; set; }
    }

    private sealed class PfuncaoRow
    {
        [JsonPropertyName("CODIGO")]
        public string? Codigo { get; set; }
        [JsonPropertyName("CARGO")]
        public string? Cargo { get; set; }
        [JsonPropertyName("NOME")]
        public string? Nome { get; set; }
    }

    private sealed class TransfPromocaoRow
    {
        [JsonPropertyName("CHAPA")]
        public string? Chapa { get; set; }
        [JsonPropertyName("IDHIERARQUIADESTINO")]
        public int? IdHierarquiaDestino { get; set; }
        [JsonPropertyName("DATACONCLUSAO")]
        public DateTime? DataConclusao { get; set; }
        [JsonPropertyName("CODSTATUS")]
        public int? CodStatus { get; set; }
    }

    private sealed record BulkResponse(int Created, int Updated, int Skipped, int SkippedInactive, int Total);
}
