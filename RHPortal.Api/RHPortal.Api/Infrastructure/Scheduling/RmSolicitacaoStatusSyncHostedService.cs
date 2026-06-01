using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Npgsql;
using RhPortal.Api.Application.SolicitacoesVaga;
using RhPortal.Api.Contracts.Rm;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Infrastructure.Scheduling;

/// <summary>
/// Sincroniza CODSTATUS RM → <c>SolicitacaoVaga</c> por tenant em intervalo configurável.
/// </summary>
public sealed class RmSolicitacaoStatusSyncHostedService : BackgroundService
{
    private static readonly TimeSpan DispatcherPollInterval = TimeSpan.FromMinutes(1);

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

        var sync = scope.ServiceProvider.GetRequiredService<ISolicitacaoVagaRmCodStatusSyncService>();
        var import = scope.ServiceProvider.GetRequiredService<ISolicitacaoVagaRmImportService>();
        var importResult = await import.ImportarAprovadasAsync(new RmRequisicaoImportRequest
        {
            PageSize = maxPerRun
        }, ct);

        if (importResult.Criados > 0 || importResult.Atualizados > 0 || importResult.Erros > 0)
        {
            _logger.LogInformation(
                "Rm import tenant {TenantId}: lidos={Total}, criados={Criados}, atualizados={Atualizados}, vagas={Vagas}, ign={Ign}, err={Err}",
                tenantId, importResult.TotalLidos, importResult.Criados, importResult.Atualizados,
                importResult.VagasCriadas, importResult.Ignorados, importResult.Erros);
        }

        var result = await sync.RunBatchAsync(new RmSolicitacaoStatusSyncRequest(), maxPerRun, ct);

        if (result.Erros > 0 || result.Mensagem is not null)
        {
            _logger.LogInformation(
                "Rm CODSTATUS sync tenant {TenantId}: lidos={Total}, ok={Ok}, ign={Ign}, err={Err}, msg={Msg}",
                tenantId, result.TotalLidos, result.Atualizados, result.Ignorados, result.Erros, result.Mensagem);
        }
    }
}
