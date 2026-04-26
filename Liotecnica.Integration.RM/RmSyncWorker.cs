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
    private readonly PortalAreaSyncService _areaSync;
    private readonly PortalCategoriaSyncService _categoriaSync;
    private readonly PortalCargoSyncService _cargoSync;
    private readonly PortalUnitSyncService _unitSync;
    private readonly PortalPessoaSyncService _pessoaSync;
    private readonly PortalFuncionarioSyncService _funcionarioSync;
    private readonly PortalVagaSyncService _vagaSync;
    private readonly PortalTalentoSyncService _talentoSync;
    private readonly PortalCandidatoVagaSyncService _candidatoVagaSync;
    private readonly ExtractionLogWriter _logWriter;
    private readonly RmSyncOptions _syncOptions;

    public RmSyncWorker(
        ILogger<RmSyncWorker> logger,
        IOptions<RmConnectionOptions> rmOptions,
        IOptions<RmSchemaOptions> schemaOptions,
        IOptions<RmSyncOptions> syncOptions,
        PortalApiClient portalClient,
        RmDataExtractor extractor,
        PortalAreaSyncService areaSync,
        PortalCategoriaSyncService categoriaSync,
        PortalCargoSyncService cargoSync,
        PortalUnitSyncService unitSync,
        PortalPessoaSyncService pessoaSync,
        PortalFuncionarioSyncService funcionarioSync,
        PortalVagaSyncService vagaSync,
        PortalTalentoSyncService talentoSync,
        PortalCandidatoVagaSyncService candidatoVagaSync,
        ExtractionLogWriter logWriter)
    {
        _logger = logger;
        _rmOptions = rmOptions.Value;
        _schemaOptions = schemaOptions.Value;
        _syncOptions = syncOptions.Value;
        _portalClient = portalClient;
        _extractor = extractor;
        _areaSync = areaSync;
        _categoriaSync = categoriaSync;
        _cargoSync = cargoSync;
        _unitSync = unitSync;
        _pessoaSync = pessoaSync;
        _funcionarioSync = funcionarioSync;
        _vagaSync = vagaSync;
        _talentoSync = talentoSync;
        _candidatoVagaSync = candidatoVagaSync;
        _logWriter = logWriter;
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
            await _extractor.ExtractSchemaAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha na extração de schema; continuando.");
            _logWriter.WriteLine($"Extração de schema: ERRO - {ex.Message}");
        }

        try
        {
            await _extractor.ExtractAndSaveAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha na extração de dados; continuando.");
            _logWriter.WriteLine($"Extração de dados: ERRO - {ex.Message}");
        }

        try
        {
            await _areaSync.SyncAreasFromDepartamentoJsonAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha no envio de departamento (centro de custo) para a API; continuando.");
            _logWriter.WriteLine($"Sync Centros de Custo (departamento -> api/centros-custo): ERRO - {ex.Message}");
        }

        try
        {
            await _categoriaSync.SyncCategoriasFromCargoJsonAsync(ct); // PFUNCAO → Funções (api/requisito-categorias)
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha no envio de Funções para a API; continuando.");
            _logWriter.WriteLine($"Sync Funções (PFUNCAO -> api/requisito-categorias): ERRO - {ex.Message}");
        }

        try
        {
            await _cargoSync.SyncCargosFromCargoJsonAsync(ct); // PCARGO → Cargos (api/job-positions)
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha no envio de Cargos para a API; continuando.");
            _logWriter.WriteLine($"Sync Cargos (PCARGO -> api/job-positions): ERRO - {ex.Message}");
        }

        if (_syncOptions.SyncUnits && _syncOptions.SyncUnitsExecute)
        {
            try
            {
                await _unitSync.SyncUnitsFromUnidadeJsonAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha no envio de unidade para a API; continuando.");
                _logWriter.WriteLine($"Sync Unidades (unidade -> api/units): ERRO - {ex.Message}");
            }
        }
        else if (_syncOptions.SyncUnits)
        {
            _logWriter.WriteLine("Sync Unidades: ativo no integrador, execução desabilitada (RmSync.SyncUnitsExecute = false).");
        }

        try
        {
            await _pessoaSync.SyncPessoasFromPessoaJsonAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha no envio de pessoa para a API; continuando.");
            _logWriter.WriteLine($"Sync Pessoas (pessoa -> api/pessoas): ERRO - {ex.Message}");
        }

        try
        {
            await _funcionarioSync.SyncFuncionariosFromFuncionarioJsonAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha no envio de funcionário para a API; continuando.");
            _logWriter.WriteLine($"Sync Funcionários (funcionario -> api/funcionarios): ERRO - {ex.Message}");
        }

        if (_syncOptions.SyncVagas)
        {
            try
            {
                await _extractor.ExtractVagasEmAbertoOnlyAsync(ct);
                await _vagaSync.SyncVagasFromVagaJsonAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha no sync de vagas em aberto; continuando.");
                _logWriter.WriteLine($"Sync Vagas (vaga -> api/vagas): ERRO - {ex.Message}");
            }
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
                try
                {
                    await _extractor.ExtractCandidatosPorVagaAsync(ct);
                    if (_syncOptions.SyncCandidatosPerfilCv)
                        await _extractor.ExtractCandidatoPerfilAsync(ct);
                    var emailToTalentoId = await _talentoSync.SyncTalentosAndGetEmailToIdMapAsync(ct);
                    await _candidatoVagaSync.SyncCandidatosFromCandidatoVagaJsonAsync(ct, emailToTalentoId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Falha no sync de talentos/candidatos por vaga.");
                    _logWriter.WriteLine($"Sync Talentos/Candidatos por vaga: ERRO - {ex.Message}");
                }
            }
        }

        _logWriter.WriteLine("========== Sincronização RM concluída ==========");
    }

    /// <summary>Executa apenas extração de vagas em aberto + envio para api/vagas. Não extrai nem envia áreas, cargos, unidades, pessoas ou funcionários (evita duplicar).</summary>
    private async Task SyncVagasOnlyAsync(CancellationToken ct)
    {
        _logWriter.WriteLine("========== Sincronização RM (apenas vagas em aberto) iniciada ==========");
        try
        {
            await _extractor.ExtractVagasEmAbertoOnlyAsync(ct);
            await _vagaSync.SyncVagasFromVagaJsonAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha no sync de vagas em aberto.");
            _logWriter.WriteLine($"Sync Vagas: ERRO - {ex.Message}");
        }
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
            try
            {
                await _extractor.ExtractCandidatosPorVagaAsync(ct);
                if (_syncOptions.SyncCandidatosPerfilCv)
                    await _extractor.ExtractCandidatoPerfilAsync(ct);
                var emailToTalentoId = await _talentoSync.SyncTalentosAndGetEmailToIdMapAsync(ct);
                await _candidatoVagaSync.SyncCandidatosFromCandidatoVagaJsonAsync(ct, emailToTalentoId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha no sync de talentos/candidatos por vaga.");
                _logWriter.WriteLine($"Sync Talentos/Candidatos por vaga: ERRO - {ex.Message}");
            }
        }
        _logWriter.WriteLine("========== Sincronização RM (apenas vagas) concluída ==========");
    }
}
