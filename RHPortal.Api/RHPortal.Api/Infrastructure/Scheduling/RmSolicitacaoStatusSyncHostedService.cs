using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Npgsql;
using RhPortal.Api.Application.SolicitacoesVaga;
using RhPortal.Api.Contracts.Rm;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using System.Text;

namespace RhPortal.Api.Infrastructure.Scheduling;

/// <summary>
/// Sincroniza CODSTATUS RM → <c>SolicitacaoVaga</c> por tenant em intervalo configurável.
/// </summary>
public sealed class RmSolicitacaoStatusSyncHostedService : BackgroundService
{
    private static readonly TimeSpan DispatcherPollInterval = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan LogRetention = TimeSpan.FromDays(60);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RmSolicitacaoStatusSyncHostedService> _logger;
    private readonly Dictionary<string, DateTimeOffset> _lastRunByTenant = new(StringComparer.OrdinalIgnoreCase);

    public RmSolicitacaoStatusSyncHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<RmSolicitacaoStatusSyncHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessAllTenantsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (ObjectDisposedException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RmSolicitacaoStatusSyncHostedService batch failed.");
            }

            try { await Task.Delay(DispatcherPollInterval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task ProcessAllTenantsAsync(CancellationToken ct)
    {
        List<string> tenantIds;
        using (var masterScope = _scopeFactory.CreateScope())
        {
            var masterDb = masterScope.ServiceProvider.GetRequiredService<MasterDbContext>();
            tenantIds = await masterDb.Tenants
                .AsNoTracking()
                .Where(t => t.IsActive)
                .Select(t => t.TenantId)
                .ToListAsync(ct);
        }

        foreach (var tenantId in tenantIds)
        {
            try
            {
                await ProcessTenantAsync(tenantId, ct);
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01")
            {
                _logger.LogWarning("Tenant {TenantId}: schema missing. Run migrations.", tenantId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Rm CODSTATUS sync failed for tenant {TenantId}.", tenantId);
            }
        }
    }

    private async Task ProcessTenantAsync(string tenantId, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantContext.SetTenantId(tenantId);

        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var config = await db.TenantConfiguracoes.AsNoTracking().FirstOrDefaultAsync(ct);
        if (config?.RequisicoesVagaOrigemRm != true || config.RmImportacaoAutomaticaAtiva != true)
            return;

        var interval = TimeSpan.FromMinutes(Math.Clamp(config.RmImportacaoAutomaticaIntervaloMinutos, 1, 1440));
        var now = DateTimeOffset.UtcNow;
        if (_lastRunByTenant.TryGetValue(tenantId, out var lastRun) && now - lastRun < interval)
            return;

        _lastRunByTenant[tenantId] = now;
        var maxPerRun = Math.Clamp(config.RmImportacaoAutomaticaMaxPorExecucao, 1, 500);

        var log = new StringBuilder();
        AppendLog(log, $"Iniciando ciclo automático RM para tenant {tenantId}.");
        AppendLog(log, $"Configuração: intervalo={interval.TotalMinutes:0} minuto(s), maxPorExecucao={maxPerRun}.");

        var run = new RmImportacaoAutomaticaRun
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            StartedAtUtc = now,
            Status = "EmExecucao",
            IntervalMinutes = (int)interval.TotalMinutes,
            MaxPerRun = maxPerRun,
            LogText = log.ToString()
        };
        db.RmImportacaoAutomaticaRuns.Add(run);
        await db.SaveChangesAsync(ct);

        var sync = scope.ServiceProvider.GetRequiredService<ISolicitacaoVagaRmCodStatusSyncService>();
        var import = scope.ServiceProvider.GetRequiredService<ISolicitacaoVagaRmImportService>();
        try
        {
            var importResult = await import.ImportarAprovadasAsync(new RmRequisicaoImportRequest
            {
                PageSize = maxPerRun
            }, ct);

            run.TotalLidos = importResult.TotalLidos;
            run.Criados = importResult.Criados;
            run.Atualizados = importResult.Atualizados;
            run.VagasCriadas = importResult.VagasCriadas;
            run.Ignorados = importResult.Ignorados;
            run.Erros = importResult.Erros;

            AppendLog(log, $"Importação: lidos={importResult.TotalLidos}, criados={importResult.Criados}, atualizados={importResult.Atualizados}, vagasCriadas={importResult.VagasCriadas}, ignorados={importResult.Ignorados}, erros={importResult.Erros}.");
            foreach (var message in importResult.Mensagens.Take(200))
                AppendLog(log, message);
            if (importResult.Mensagens.Count > 200)
                AppendLog(log, $"Foram omitidas {importResult.Mensagens.Count - 200} mensagem(ns) adicionais para limitar o tamanho do log.");

            if (importResult.Criados > 0 || importResult.Atualizados > 0 || importResult.Erros > 0)
            {
                _logger.LogInformation(
                    "Rm import tenant {TenantId}: lidos={Total}, criados={Criados}, atualizados={Atualizados}, vagas={Vagas}, ign={Ign}, err={Err}",
                    tenantId, importResult.TotalLidos, importResult.Criados, importResult.Atualizados,
                    importResult.VagasCriadas, importResult.Ignorados, importResult.Erros);
            }

            var result = await sync.RunBatchAsync(new RmSolicitacaoStatusSyncRequest(), maxPerRun, ct);
            run.StatusSyncTotalLidos = result.TotalLidos;
            run.StatusSyncAtualizados = result.Atualizados;
            run.StatusSyncIgnorados = result.Ignorados;
            run.StatusSyncErros = result.Erros;

            AppendLog(log, $"Sincronização CODSTATUS: lidos={result.TotalLidos}, atualizados={result.Atualizados}, ignorados={result.Ignorados}, erros={result.Erros}.");
            if (!string.IsNullOrWhiteSpace(result.Mensagem))
                AppendLog(log, result.Mensagem);

            if (result.Erros > 0 || result.Mensagem is not null)
            {
                _logger.LogInformation(
                    "Rm CODSTATUS sync tenant {TenantId}: lidos={Total}, ok={Ok}, ign={Ign}, err={Err}, msg={Msg}",
                    tenantId, result.TotalLidos, result.Atualizados, result.Ignorados, result.Erros, result.Mensagem);
            }

            run.Status = importResult.Erros > 0 || result.Erros > 0 ? "ConcluidoComErros" : "Sucesso";
            run.Mensagem = run.Status == "Sucesso"
                ? "Ciclo concluído com sucesso."
                : "Ciclo concluído com erros. Consulte o log.";
        }
        catch (Exception ex)
        {
            run.Status = "Erro";
            run.Mensagem = TrimTo(ex.Message, 1000);
            run.Erros = Math.Max(run.Erros, 1);
            AppendLog(log, $"ERRO: {ex.GetType().Name}: {ex.Message}");
            _logger.LogError(ex, "Rm automatic import failed for tenant {TenantId}.", tenantId);
        }
        finally
        {
            run.FinishedAtUtc = DateTimeOffset.UtcNow;
            AppendLog(log, $"Ciclo finalizado com status {run.Status}.");
            run.LogText = log.ToString();
            await db.SaveChangesAsync(ct);
            await PruneOldRunsAsync(db, ct);
        }
    }

    private static void AppendLog(StringBuilder log, string message)
    {
        log.Append('[')
            .Append(DateTimeOffset.UtcNow.ToString("yyyy-MM-dd HH:mm:ss 'UTC'"))
            .Append("] ")
            .AppendLine(message);
    }

    private static async Task PruneOldRunsAsync(AppDbContext db, CancellationToken ct)
    {
        var cutoff = DateTimeOffset.UtcNow.Subtract(LogRetention);
        await db.RmImportacaoAutomaticaRuns
            .Where(x => x.StartedAtUtc < cutoff)
            .ExecuteDeleteAsync(ct);
    }

    private static string TrimTo(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];
}
