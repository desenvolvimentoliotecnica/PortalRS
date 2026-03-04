using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Envia vagas em aberto do RM (vaga.json) para o Portal (api/vagas).
/// Só integra vagas; não altera áreas, cargos, unidades, pessoas ou funcionários.
/// Usa Codigo (CODVAGA) para evitar duplicata: se já existir vaga com o mesmo código, atualiza; senão cria.
/// </summary>
public sealed class PortalVagaSyncService
{
    private readonly ILogger<PortalVagaSyncService> _logger;
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

    /// <summary>Status Aberta no Portal (VagaStatus.Aberta = 2).</summary>
    private const short StatusAberta = 2;

    public PortalVagaSyncService(
        ILogger<PortalVagaSyncService> logger,
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
    /// Lê vaga.json (vagas em aberto extraídas do RM) e envia para api/vagas (cria ou atualiza por código).
    /// Não envia áreas, cargos, unidades, pessoas nem funcionários.
    /// </summary>
    public async Task SyncVagasFromVagaJsonAsync(CancellationToken ct = default)
    {
        try
        {
            await SyncVagasFromVagaJsonCoreAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync Vagas: falha geral.");
            _logWriter.WriteLine($"Sync Vagas: falha geral - {ex.Message}");
        }
    }

    private async Task SyncVagasFromVagaJsonCoreAsync(CancellationToken ct)
    {
        var path = GetSchemaTablesPath();
        var file = Path.Combine(path, "vaga.json");
        if (!File.Exists(file))
        {
            _logWriter.WriteLine("Sync Vagas: arquivo vaga.json não encontrado; pulando envio.");
            _logger.LogWarning("Arquivo {File} não encontrado; pulando sync de vagas.", file);
            return;
        }

        var json = await File.ReadAllTextAsync(file, ct);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (root.ValueKind != JsonValueKind.Array)
        {
            _logWriter.WriteLine("Sync Vagas: vaga.json não é um array; pulando.");
            return;
        }

        var (areaId, departmentId) = await GetDefaultAreaAndDepartmentAsync(ct);
        if (areaId == Guid.Empty)
        {
            _logWriter.WriteLine("Sync Vagas: é necessário uma Área já cadastrada no Portal (sincronize áreas antes ou configure RmSync.VagaDefaultAreaCode); pulando.");
            _logger.LogWarning("Sync Vagas: Área não encontrada no Portal; pulando.");
            return;
        }

        var codigoToId = await LoadExistingVagasByCodigoAsync(ct);
        var created = 0;
        var updated = 0;
        var skipped = 0;

        foreach (var row in root.EnumerateArray())
        {
            try
            {
                var titulo = GetString(row, "NOME")?.Trim();
                if (string.IsNullOrWhiteSpace(titulo))
                {
                    skipped++;
                    continue;
                }
                if (titulo!.Length > 160) titulo = titulo.Substring(0, 160);

                var codigo = GetString(row, "CODVAGA")?.Trim();
                if (string.IsNullOrWhiteSpace(codigo)) codigo = titulo.Length > 40 ? titulo.Substring(0, 40) : titulo;
                if (codigo.Length > 40) codigo = codigo.Substring(0, 40);

                var payload = BuildVagaPayload(titulo, codigo, areaId, departmentId == Guid.Empty ? null : (Guid?)departmentId, row);

                if (codigoToId.TryGetValue(codigo, out var existingId))
                {
                    var response = await _portalClient.Http.PutAsJsonAsync($"api/vagas/{existingId}", payload, JsonOptions, ct);
                    if (response.IsSuccessStatusCode)
                    {
                        updated++;
                    }
                    else
                    {
                        var msg = await response.Content.ReadAsStringAsync(ct);
                        _logWriter.WriteLine($"Sync Vagas: PUT falhou Codigo={codigo}: {response.StatusCode} {msg}");
                    }
                }
                else
                {
                    var response = await _portalClient.Http.PostAsJsonAsync("api/vagas", payload, JsonOptions, ct);
                    if (response.IsSuccessStatusCode)
                    {
                        var createdResp = await response.Content.ReadFromJsonAsync<VagaCreateResponse>(JsonOptions, ct);
                        if (createdResp != null && !string.IsNullOrEmpty(codigo))
                        {
                            codigoToId[codigo] = createdResp.Id;
                            created++;
                        }
                    }
                    else
                    {
                        var msg = await response.Content.ReadAsStringAsync(ct);
                        _logWriter.WriteLine($"Sync Vagas: POST falhou Codigo={codigo}: {response.StatusCode} {msg}");
                        if (created == 0 && updated == 0)
                            _logger.LogWarning("POST api/vagas exemplo de erro: {Msg}", msg.Length > 500 ? msg.Substring(0, 500) : msg);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Sync Vagas: exceção ao processar linha; continuando.");
                _logWriter.WriteLine($"Sync Vagas: exceção - {ex.Message}");
            }
        }

        _logWriter.WriteLine($"Sync Vagas: concluído. Criadas: {created}, atualizadas: {updated}, ignoradas: {skipped}");
        _logger.LogInformation("Sync Vagas: criadas={Created}, atualizadas={Updated}, ignoradas={Skipped}", created, updated, skipped);
    }

    private static object BuildVagaPayload(string titulo, string codigo, Guid areaId, Guid? departmentId, JsonElement row)
    {
        var observacao = GetString(row, "OBSERVACAO");
        var dataAbertura = GetDateTime(row, "DATAABERTURA");
        var dataFechamento = GetDateTime(row, "DATAFECHAMENTO");
        DateOnly? dataInicio = dataAbertura.HasValue ? DateOnly.FromDateTime(dataAbertura.Value) : null;
        DateOnly? dataEncerramento = dataFechamento.HasValue ? DateOnly.FromDateTime(dataFechamento.Value) : null;
        var descricaoPublica = string.IsNullOrWhiteSpace(observacao) ? null : observacao.Trim();
        if (descricaoPublica != null && descricaoPublica.Length > 2000) descricaoPublica = descricaoPublica.Substring(0, 2000);

        return new
        {
            titulo,
            departmentId,
            areaId,
            status = StatusAberta,
            codigo = codigo.Length > 40 ? codigo.Substring(0, 40) : codigo,
            areaTime = (short?)null,
            modalidade = (short?)null,
            senioridade = (short?)null,
            quantidadeVagas = 1,
            tipoContratacao = (short?)null,
            matchMinimoPercentual = 70,
            weights = new { competencia = 40, experiencia = 30, formacao = 15, localidade = 15 },
            descricaoInterna = (string?)null,
            codigoInterno = (string?)null,
            codigoCbo = (string?)null,
            motivoAbertura = (short?)null,
            orcamentoAprovado = (short?)null,
            gestorRequisitante = (string?)null,
            recrutadorResponsavel = (string?)null,
            prioridade = (short?)null,
            resumoPitch = (string?)null,
            tagsResponsabilidadesRaw = (string?)null,
            tagsKeywordsRaw = (string?)null,
            confidencial = false,
            aceitaPcd = false,
            urgente = false,
            generoPreferencia = (short?)null,
            vagaAfirmativa = false,
            linguagemInclusiva = false,
            publicoAfirmativo = (string?)null,
            observacoesPcd = (string?)null,
            projetoNome = (string?)null,
            projetoClienteAreaImpactada = (string?)null,
            projetoPrazoPrevisto = (string?)null,
            projetoDescricao = (string?)null,
            regime = (short?)null,
            cargaSemanalHoras = (int?)null,
            escala = (short?)null,
            horaEntrada = (TimeOnly?)null,
            horaSaida = (TimeOnly?)null,
            intervalo = (TimeSpan?)null,
            cep = (string?)null,
            logradouro = GetString(row, "LOCAL"),
            numero = (string?)null,
            bairro = (string?)null,
            cidade = (string?)null,
            uf = (string?)null,
            politicaTrabalho = (string?)null,
            observacoesDeslocamento = (string?)null,
            moeda = (short?)null,
            salarioMinimo = GetDecimal(row, "SALARIO"),
            salarioMaximo = GetDecimal(row, "REMUNERACAO"),
            periodicidade = (short?)null,
            bonusTipo = (short?)null,
            bonusPercentual = (decimal?)null,
            observacoesRemuneracao = (string?)null,
            escolaridade = (short?)null,
            formacaoArea = (short?)null,
            experienciaMinimaAnos = (int?)null,
            tagsStackRaw = (string?)null,
            tagsIdiomasRaw = (string?)null,
            diferenciais = (string?)null,
            observacoesProcesso = (string?)null,
            visibilidade = (short?)null,
            dataInicio,
            dataEncerramento,
            canalLinkedIn = false,
            canalSiteCarreiras = true,
            canalIndicacao = false,
            canalPortaisEmprego = false,
            descricaoPublica,
            lgpdSolicitarConsentimentoExplicito = false,
            lgpdCompartilharCurriculoInternamente = false,
            lgpdRetencaoAtiva = false,
            lgpdRetencaoMeses = (int?)null,
            exigeCnh = false,
            disponibilidadeParaViagens = false,
            checagemAntecedentes = false,
            slaDiasMetaFechamento = (int?)null,
            beneficios = (object?)null,
            requisitos = (object?)null,
            etapas = (object?)null,
            perguntasTriagem = (object?)null
        };
    }

    private static string? GetString(JsonElement row, string prop)
    {
        if (!row.TryGetProperty(prop, out var el)) return null;
        if (el.ValueKind == JsonValueKind.Null || el.ValueKind == JsonValueKind.Undefined) return null;
        return el.GetString();
    }

    private static DateTime? GetDateTime(JsonElement row, string prop)
    {
        if (!row.TryGetProperty(prop, out var el)) return null;
        if (el.ValueKind == JsonValueKind.Null || el.ValueKind == JsonValueKind.Undefined) return null;
        if (el.TryGetDateTime(out var dt)) return dt;
        var s = el.GetString();
        return DateTime.TryParse(s, out var parsed) ? parsed : null;
    }

    private static decimal? GetDecimal(JsonElement row, string prop)
    {
        if (!row.TryGetProperty(prop, out var el)) return null;
        if (el.ValueKind == JsonValueKind.Null || el.ValueKind == JsonValueKind.Undefined) return null;
        if (el.ValueKind == JsonValueKind.Number && el.TryGetDecimal(out var d)) return d;
        var s = el.ValueKind == JsonValueKind.String ? el.GetString() : el.GetRawText();
        return decimal.TryParse(s, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsed) ? parsed : null;
    }

    /// <summary>
    /// Obtém a Área e o Departamento já cadastrados no Portal (sincronizados do RM).
    /// Usa VagaDefaultAreaCode e VagaDefaultDepartmentCode para localizar exatamente a Área e o Departamento.
    /// Departamento é buscado entre os que pertencem à Área selecionada (integração exata). Não cria área/departamento.
    /// </summary>
    private async Task<(Guid AreaId, Guid DepartmentId)> GetDefaultAreaAndDepartmentAsync(CancellationToken ct)
    {
        var areaId = Guid.Empty;
        var departmentId = Guid.Empty;
        try
        {
            // 1) Áreas = as que vieram do RM (PSECAO → api/areas). Code = CODIGO da seção no RM.
            var areas = await _portalClient.Http.GetFromJsonAsync<List<AreaItem>>("api/areas", JsonOptions, ct);
            if (areas == null || areas.Count == 0)
            {
                _logWriter.WriteLine("Sync Vagas: nenhuma Área encontrada no Portal. Sincronize antes as áreas (departamento/PSECAO).");
                _logger.LogWarning("Sync Vagas: nenhuma Área no Portal; sincronize áreas antes.");
                return (Guid.Empty, Guid.Empty);
            }

            var areaCode = _syncOptions.VagaDefaultAreaCode?.Trim();
            var area = !string.IsNullOrEmpty(areaCode)
                ? areas.Find(a => string.Equals((a.Code ?? "").Trim(), areaCode, StringComparison.OrdinalIgnoreCase))
                : areas.FirstOrDefault();
            if (area == null)
            {
                _logWriter.WriteLine($"Sync Vagas: Área com Code='{areaCode}' não encontrada. Configure RmSync.VagaDefaultAreaCode com o código da área cadastrada (ex.: do PSECAO).");
                _logger.LogWarning("Sync Vagas: Área Code={Code} não encontrada.", areaCode ?? "(vazio)");
                return (Guid.Empty, Guid.Empty);
            }
            areaId = area.Id;
            _logWriter.WriteLine($"Sync Vagas: usando Área cadastrada Code={area.Code} (Id={areaId}).");

            // 2) Departamentos da Área selecionada (integração exata: só departamentos dessa área)
            var deptResponse = await _portalClient.Http.GetFromJsonAsync<PagedDepartmentsResponse>(
                $"api/departments?areaId={areaId}&page=1&pageSize=500", JsonOptions, ct);
            var deptList = deptResponse?.Items ?? new List<DepartmentItem>();
            if (deptList.Count == 0)
            {
                // Fallback: listar todos e pegar o que pertence à área ou o primeiro (compatibilidade)
                deptResponse = await _portalClient.Http.GetFromJsonAsync<PagedDepartmentsResponse>("api/departments?page=1&pageSize=500", JsonOptions, ct);
                deptList = deptResponse?.Items ?? new List<DepartmentItem>();
            }

            if (deptList.Count == 0)
            {
                _logWriter.WriteLine("Sync Vagas: nenhum Departamento encontrado no Portal para a Área selecionada. Cadastre um departamento vinculado a essa área.");
                _logger.LogWarning("Sync Vagas: nenhum Departamento no Portal para a área {AreaId}.", areaId);
                return (areaId, Guid.Empty);
            }

            var deptCode = _syncOptions.VagaDefaultDepartmentCode?.Trim();
            var dept = !string.IsNullOrEmpty(deptCode)
                ? deptList.Find(d => string.Equals((d.Code ?? "").Trim(), deptCode, StringComparison.OrdinalIgnoreCase)) ?? deptList.FirstOrDefault()
                : deptList.FirstOrDefault();
            if (dept != null)
            {
                departmentId = dept.Id;
                _logWriter.WriteLine($"Sync Vagas: usando Departamento cadastrado Code={dept.Code} (Id={departmentId}).");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao obter área/departamento do portal.");
            _logWriter.WriteLine($"Sync Vagas: falha ao obter área/departamento - {ex.Message}");
        }
        return (areaId, departmentId);
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
            _logger.LogWarning(ex, "Falha ao carregar vagas existentes do portal; assumindo nenhuma.");
            _logWriter.WriteLine($"Sync Vagas: falha ao carregar vagas existentes - {ex.Message}");
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

    private sealed record AreaItem(Guid Id, string Code, string Name);
    private sealed record PagedDepartmentsResponse(List<DepartmentItem>? Items);
    private sealed record DepartmentItem(Guid Id, string Code, string Name);
    private sealed record VagaListItem(Guid Id, string? Codigo, string Titulo);
    private sealed record VagaCreateResponse(Guid Id);
}
