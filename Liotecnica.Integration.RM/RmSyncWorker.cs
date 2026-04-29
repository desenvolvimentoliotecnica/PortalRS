using Liotecnica.Integration.RM.Schema;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Worker que sincroniza dados do banco RM para o Portal RH via API.
/// Extrai schema + tabelas (área, departamento, cargo, vaga, unidade, funcionário, pessoa).
/// Sync: Departamento→Área, Função (PFUNCAO)→Funções, Cargo (PCARGO)→Cargos, Unidade→Unit, Pessoa→Pessoa, Funcionário→Funcionario.
/// </summary>
public sealed class RmSyncWorker : BackgroundService
{
    private readonly ILogger<RmSyncWorker> _logger;
    private readonly RmConnectionOptions _rmOptions;
    private readonly RmSchemaOptions _schemaOptions;
    private readonly PortalApiClient _portalClient;
    private readonly RmDataExtractor _extractor;
    private readonly PortalHierarquiaSyncService _hierarquiaSync;
    private readonly PortalDesligamentoSyncService _desligamentoSync;
    private readonly PortalFuncionarioMovimentacaoSyncService _movimentacaoSync;
    private readonly PortalEmpresaSyncService _empresaSync;
    private readonly PortalAreaSyncService _areaSync;
    private readonly PortalCategoriaSyncService _categoriaSync;
    private readonly PortalCargoSyncService _cargoSync;
    private readonly PortalUnitSyncService _unitSync;
    private readonly PortalPessoaBulkSyncService _pessoaBulkSync;
    private readonly PortalFuncionarioSyncService _funcionarioSync;
    private readonly PortalVagaSyncService _vagaSync;
    private readonly PortalTalentoSyncService _talentoSync;
    private readonly PortalCandidatoVagaSyncService _candidatoVagaSync;
    private readonly ExtractionLogWriter _logWriter;
    private readonly RmSyncCancellationService _cancellation;
    private readonly RmSyncOptions _syncOptions;

    public RmSyncWorker(
        ILogger<RmSyncWorker> logger,
        IOptions<RmConnectionOptions> rmOptions,
        IOptions<RmSchemaOptions> schemaOptions,
        IOptions<RmSyncOptions> syncOptions,
        PortalApiClient portalClient,
        RmDataExtractor extractor,
        PortalHierarquiaSyncService hierarquiaSync,
        PortalDesligamentoSyncService desligamentoSync,
        PortalFuncionarioMovimentacaoSyncService movimentacaoSync,
        PortalEmpresaSyncService empresaSync,
        PortalAreaSyncService areaSync,
        PortalCategoriaSyncService categoriaSync,
        PortalCargoSyncService cargoSync,
        PortalUnitSyncService unitSync,
        PortalPessoaBulkSyncService pessoaBulkSync,
        PortalFuncionarioSyncService funcionarioSync,
        PortalVagaSyncService vagaSync,
        PortalTalentoSyncService talentoSync,
        PortalCandidatoVagaSyncService candidatoVagaSync,
        ExtractionLogWriter logWriter,
        RmSyncCancellationService cancellation)
    {
        _logger = logger;
        _rmOptions = rmOptions.Value;
        _schemaOptions = schemaOptions.Value;
        _syncOptions = syncOptions.Value;
        _portalClient = portalClient;
        _extractor = extractor;
        _hierarquiaSync = hierarquiaSync;
        _desligamentoSync = desligamentoSync;
        _movimentacaoSync = movimentacaoSync;
        _empresaSync = empresaSync;
        _areaSync = areaSync;
        _categoriaSync = categoriaSync;
        _cargoSync = cargoSync;
        _unitSync = unitSync;
        _pessoaBulkSync = pessoaBulkSync;
        _funcionarioSync = funcionarioSync;
        _vagaSync = vagaSync;
        _talentoSync = talentoSync;
        _candidatoVagaSync = candidatoVagaSync;
        _logWriter = logWriter;
        _cancellation = cancellation;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = _syncOptions.IntervalMinutes < 1 ? 5 : _syncOptions.IntervalMinutes;
        _logger.LogInformation("RmSyncWorker iniciado. Tabelas: {Tables}. Ciclo a cada {Minutes} min.",
            string.Join(", ", RmTableNames.All), interval);
        _logWriter.WriteLine($"Worker iniciado. Intervalo entre ciclos: {interval} min.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SyncAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no ciclo de sincronização RM -> Portal");
                _logWriter.WriteLine($"ERRO no ciclo: {ex.Message}");
            }

            if (stoppingToken.IsCancellationRequested) break;
            _logger.LogInformation("Próximo ciclo em {Minutes} min.", interval);
            _logWriter.WriteLine($"Aguardando próximo ciclo em {interval} min.");
            await Task.Delay(TimeSpan.FromMinutes(interval), stoppingToken);
        }

        _logWriter.WriteLine("Worker encerrado.");
    }

    /// <summary>Executa um ciclo completo de sincronização (extração + envio para API).</summary>
    public Task RunOneCycleAsync(CancellationToken ct = default) => SyncAsync(ct);

    private async Task SyncAsync(CancellationToken ct)
    {
        // Gating comercial (Opção C): antes de qualquer trabalho, confirma que o módulo
        // 'totvs-rm' continua habilitado para este tenant no Portal. Quando OFF, o ciclo
        // é pulado limpamente — sem queries SQL no RM, sem chamadas POST. Owner controla
        // o switch via /Owner/Tenants/{id}/modules. Fail-open: se o endpoint cair, assume ON.
        if (!await _portalClient.IsModuleEnabledAsync("totvs-rm", ct))
        {
            _logger.LogInformation("Módulo 'totvs-rm' desabilitado para o tenant — ciclo pulado.");
            _logWriter.WriteLine("Módulo 'totvs-rm' desabilitado para o tenant — ciclo pulado.");
            return;
        }

        if (_syncOptions.SyncVagasOnly)
        {
            await SyncVagasOnlyAsync(ct);
            return;
        }

        _logWriter.WriteLine("========== Sincronização RM iniciada ==========");
        _cancellation.ClearRequest();
        try
        {
        var areaTable = _schemaOptions.FullTableName(_schemaOptions.AreaTable);
        var departamentoTable = _schemaOptions.FullTableName(_schemaOptions.DepartamentoTable);
        var funcaoTable = _schemaOptions.FullTableName(_schemaOptions.FuncaoTable);
        var cargoTable = _schemaOptions.FullTableName(_schemaOptions.CargoTable);
        var vagaTable = _schemaOptions.FullTableName(_schemaOptions.VagaTable);
        var unidadeTable = _schemaOptions.FullTableName(_schemaOptions.UnidadeTable);
        var funcionarioTable = _schemaOptions.FullTableName(_schemaOptions.FuncionarioTable);
        var pessoaTable = _schemaOptions.FullTableName(_schemaOptions.PessoaTable);

        _logWriter.WriteLine($"Tabelas: {areaTable}, {departamentoTable}, {funcaoTable}, {cargoTable}, {vagaTable}, {unidadeTable}, {funcionarioTable}, {pessoaTable}");
        _logger.LogInformation("Sincronização: lendo de {Area}, {Dept}, {Funcao}, {Cargo}, {Vaga}, {Unidade}, {Funcionario}, {Pessoa}",
            areaTable, departamentoTable, funcaoTable, cargoTable, vagaTable, unidadeTable, funcionarioTable, pessoaTable);

        try
        {
            _cancellation.ThrowIfCancellationRequested();
            await _extractor.ExtractSchemaAsync(ct);
        }
        catch (RmSyncCancellationRequestedException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha na extração de schema; continuando.");
            _logWriter.WriteLine($"Extração de schema: ERRO - {ex.Message}");
        }

        // Sync incremental (Frente A): busca watermark vigente para cada tabela RM que suporta delta
        // (PFUNC, PPESSOA, VRSVAGAS, VREQ*) e passa para o extractor. Após o sync de cada entidade,
        // _newWatermarks preserva o MAX(RECMODIFIEDON) para persistir via UpdateCheckpointAsync no FinishOk.
        var watermarks = new Dictionary<string, DateTime?>(StringComparer.OrdinalIgnoreCase);
        foreach (var table in RmDataExtractor.IncrementalTables)
            watermarks[table] = await _portalClient.GetCheckpointAsync(table, ct);

        try
        {
            _cancellation.ThrowIfCancellationRequested();
            _newWatermarks = await _extractor.ExtractAndSaveAsync(watermarks, ct);
        }
        catch (RmSyncCancellationRequestedException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha na extração de dados; continuando.");
            _logWriter.WriteLine($"Extração de dados: ERRO - {ex.Message}");
            _newWatermarks = null;
        }

        // Hierarquia (organograma TOTVS) — Fase 1 do refactor 2026-04-26.
        // Sobe ANTES dos demais syncs porque Funcionario.HierarquiaId / Vaga.HierarquiaId
        // dependem das hierarquias estarem cadastradas.
        await TrackedSyncAsync("VHIERARQUIA", "Sync Hierarquias (VHIERARQUIA -> api/hierarquias)",
            _hierarquiaSync.SyncHierarquiasFromJsonAsync, ct);

        // Empresas (GFILIAL → api/empresas) — Fase 1 do refactor 2026-04-26.
        await TrackedSyncAsync("GFILIAL", "Sync Empresas (GFILIAL -> api/empresas)",
            _empresaSync.SyncEmpresasFromUnidadeJsonAsync, ct);

        await TrackedSyncAsync("PSECAO", "Sync Centros de Custo (departamento -> api/centros-custo)",
            _areaSync.SyncAreasFromDepartamentoJsonAsync, ct);

        await TrackedSyncAsync("PFUNCAO", "Sync Funções (PFUNCAO -> api/requisito-categorias)",
            _categoriaSync.SyncCategoriasFromCargoJsonAsync, ct);

        await TrackedSyncAsync("PCARGO", "Sync Cargos (PCARGO -> api/job-positions)",
            _cargoSync.SyncCargosFromCargoJsonAsync, ct);

        if (_syncOptions.SyncUnits && _syncOptions.SyncUnitsExecute)
        {
            await TrackedSyncAsync("UNIDADE", "Sync Unidades (unidade -> api/units)",
                _unitSync.SyncUnitsFromUnidadeJsonAsync, ct);
        }
        else if (_syncOptions.SyncUnits)
        {
            _logWriter.WriteLine("Sync Unidades: ativo no integrador, execução desabilitada (RmSync.SyncUnitsExecute = false).");
        }

        await TrackedSyncAsync("PPESSOA", "Sync Pessoas (pessoa -> api/pessoas/bulk)",
            _pessoaBulkSync.SyncAsync, ct);

        await TrackedSyncAsync("PFUNC", "Sync Funcionários (funcionario -> api/funcionarios)",
            _funcionarioSync.SyncFuncionariosFromFuncionarioJsonAsync, ct);

        // Desligamento sync (Fase 1 do refactor 2026-04-26).
        // Roda DEPOIS dos funcionários porque resolve FuncionarioId via MatriculaRm.
        await TrackedSyncAsync("VREQDESLIGAMENTO", "Sync Desligamentos (VREQDESLIGAMENTO -> api/desligamentos)",
            _desligamentoSync.SyncDesligamentosFromJsonAsync, ct);

        // Histórico de movimentações (LUC-122) — depois de funcionários, pra resolver FuncionarioId via CHAPA.
        await TrackedSyncAsync("VREQTRANSFPROMOCAO", "Sync Movimentações (VREQTRANSFPROMOCAO+VREQDESLIGAMENTO)",
            _movimentacaoSync.SyncMovimentacoesFromJsonAsync, ct);

        if (_syncOptions.SyncVagas)
        {
            // Frente C: NÃO chamamos mais ExtractVagasEmAbertoOnlyAsync — ela filtra Ativo=1 + DataFechamento>=hoje
            // e impediria a detecção de zumbis. ExtractAndSaveAsync acima já gravou vaga.json com TODAS as vagas
            // (sob filtro de watermark se for incremental). PortalVagaSyncService manda flag aberta para o controller.
            await TrackedSyncAsync("VRSVAGAS", "Sync Vagas (vaga -> api/vagas)",
                _vagaSync.SyncVagasFromVagaJsonAsync, ct);
            if (_syncOptions.SyncCandidatosVagaDiagnostic)
            {
                try
                {
                    _cancellation.ThrowIfCancellationRequested();
                    await _extractor.ExtractCandidatosPorVagaAsync(ct);
                }
                catch (RmSyncCancellationRequestedException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Falha na extração diagnóstica de candidatos por vaga.");
                    _logWriter.WriteLine($"Candidatos por vaga (diagnóstico): ERRO - {ex.Message}");
                }
            }
            if (_syncOptions.SyncCandidatosVaga)
            {
                await TrackedSyncAsync("CANDIDATOS_VAGA", "Sync Talentos/Candidatos por vaga", async innerCt =>
                {
                    _cancellation.ThrowIfCancellationRequested();
                    await _extractor.ExtractCandidatosPorVagaAsync(innerCt);
                    _cancellation.ThrowIfCancellationRequested();
                    if (_syncOptions.SyncCandidatosPerfilCv)
                        await _extractor.ExtractCandidatoPerfilAsync(innerCt);
                    _cancellation.ThrowIfCancellationRequested();
                    var emailToTalentoId = await _talentoSync.SyncTalentosAndGetEmailToIdMapAsync(innerCt);
                    _cancellation.ThrowIfCancellationRequested();
                    await _candidatoVagaSync.SyncCandidatosFromCandidatoVagaJsonAsync(innerCt, emailToTalentoId);
                }, ct);
            }
        }

        _logWriter.WriteLine("========== Sincronização RM concluída ==========");
    }

    // Status enum espelha RhPortal.Api.Domain.Enums.RmSyncStatus — sem dependência cruzada.
        catch (RmSyncCancellationRequestedException)
        {
            _logger.LogInformation("Sincronizacao RM interrompida por solicitacao do usuario.");
            _logWriter.WriteLine("========== Sincronizacao RM interrompida pelo usuario ==========");
        }
        finally
        {
            _cancellation.ClearRequest();
        }

    }

    private const short StatusSucesso = 2;
    private const short StatusFalha = 3;

    /// <summary>
    /// Watermarks novos capturados pelo extractor no ciclo atual (MAX RECMODIFIEDON por tabela base RM).
    /// Preenchido em <c>SyncAsync</c> antes dos sync services e consumido pelo <c>TrackedSyncAsync</c>:
    /// ao finalizar uma entidade com Sucesso, persiste o watermark via PUT checkpoint.
    /// </summary>
    private IReadOnlyDictionary<string, DateTime?>? _newWatermarks;

    /// <summary>
    /// Envelopa um sync em chamadas StartRun/FinishRun ao Portal e — quando a entidade é incremental
    /// (RmDataExtractor.IncrementalTables) — atualiza o checkpoint com o novo watermark APÓS sucesso.
    /// Mantém o try/catch existente (falha de uma entidade não derruba o ciclo).
    /// </summary>
    private async Task TrackedSyncAsync(
        string entidade,
        string logLabel,
        Func<CancellationToken, Task> action,
        CancellationToken ct)
    {
        DateTime? watermarkAplicado = null;
        if (_newWatermarks != null && _newWatermarks.ContainsKey(entidade))
        {
            // Watermark aplicado neste ciclo é o que estava vigente no início (não o novo).
            // Como já gravamos os JSON delta-only, _newWatermarks[entidade] contém o MAX observado.
            // Para o run, registramos o watermark "novo" (já capturado).
        }

        _cancellation.ThrowIfCancellationRequested();
        var runId = await _portalClient.StartRunAsync(entidade, "full", watermarkAplicado, ct);
        try
        {
            _cancellation.ThrowIfCancellationRequested();
            await action(ct);
            _cancellation.ThrowIfCancellationRequested();
            DateTime? watermarkNovo = null;
            if (_newWatermarks != null && _newWatermarks.TryGetValue(entidade, out var wm))
                watermarkNovo = wm;

            if (runId.HasValue)
                await _portalClient.FinishRunAsync(runId.Value, StatusSucesso, 0, 0, 0, 0, null, watermarkNovo, ct);

            if (RmDataExtractor.IncrementalTables.Contains(entidade) && watermarkNovo.HasValue)
                await _portalClient.UpdateCheckpointAsync(entidade, watermarkNovo, "Sucesso", ct);
        }
        catch (RmSyncCancellationRequestedException ex)
        {
            _logger.LogInformation("Sync {Label} interrompido por solicitacao do usuario.", logLabel);
            _logWriter.WriteLine($"{logLabel}: INTERROMPIDO - {ex.Message}");
            if (runId.HasValue)
                await _portalClient.FinishRunAsync(runId.Value, StatusFalha, 0, 0, 0, 0, ex.Message, null, CancellationToken.None);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha em {Label}; continuando.", logLabel);
            _logWriter.WriteLine($"{logLabel}: ERRO - {ex.Message}");
            if (runId.HasValue)
                await _portalClient.FinishRunAsync(runId.Value, StatusFalha, 0, 0, 0, 0, ex.Message, null, ct);
            // Em falha, NÃO avança checkpoint — próximo ciclo refaz desde o watermark anterior.
        }
    }

    /// <summary>Executa apenas extração de vagas em aberto + envio para api/vagas. Não extrai nem envia áreas, cargos, unidades, pessoas ou funcionários (evita duplicar).</summary>
    private async Task SyncVagasOnlyAsync(CancellationToken ct)
    {
        _logWriter.WriteLine("========== Sincronização RM (apenas vagas em aberto) iniciada ==========");
        await TrackedSyncAsync("VRSVAGAS", "Sync Vagas (vaga -> api/vagas)", async innerCt =>
        {
            // No modo SyncVagasOnly não passamos por ExtractAndSaveAsync, então ainda precisamos
            // popular vaga.json — usamos o caminho legado (em-aberto-only) já que o foco aqui é apenas
            // o subset ativo. Detecção de zumbi neste modo fica desabilitada (payload incompleto).
            await _extractor.ExtractVagasEmAbertoOnlyAsync(innerCt);
            await _vagaSync.SyncVagasFromVagaJsonAsync(innerCt);
        }, ct);
        if (_syncOptions.SyncCandidatosVagaDiagnostic)
        {
            try
            {
                await _extractor.ExtractCandidatosPorVagaAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha na extração diagnóstica de candidatos por vaga.");
                _logWriter.WriteLine($"Candidatos por vaga (diagnóstico): ERRO - {ex.Message}");
            }
        }
        if (_syncOptions.SyncCandidatosVaga)
        {
            await TrackedSyncAsync("CANDIDATOS_VAGA", "Sync Talentos/Candidatos por vaga", async innerCt =>
            {
                await _extractor.ExtractCandidatosPorVagaAsync(innerCt);
                if (_syncOptions.SyncCandidatosPerfilCv)
                    await _extractor.ExtractCandidatoPerfilAsync(innerCt);
                var emailToTalentoId = await _talentoSync.SyncTalentosAndGetEmailToIdMapAsync(innerCt);
                await _candidatoVagaSync.SyncCandidatosFromCandidatoVagaJsonAsync(innerCt, emailToTalentoId);
            }, ct);
        }
        _logWriter.WriteLine("========== Sincronização RM (apenas vagas) concluída ==========");
    }
}
