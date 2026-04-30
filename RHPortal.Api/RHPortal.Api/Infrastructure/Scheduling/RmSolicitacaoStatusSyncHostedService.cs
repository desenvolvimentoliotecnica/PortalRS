using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Npgsql;
using RhPortal.Api.Application.SolicitacoesVaga;
using RhPortal.Api.Contracts.Rm;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Rm;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Infrastructure.Scheduling;

/// <summary>
/// Sincroniza CODSTATUS RM → <c>SolicitacaoVaga</c> por tenant em intervalo configurável.
/// </summary>
public sealed class RmSolicitacaoStatusSyncHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IOptionsMonitor<RmSolicitacaoStatusSyncOptions> _options;
    private readonly ILogger<RmSolicitacaoStatusSyncHostedService> _logger;

    public RmSolicitacaoStatusSyncHostedService(
        IServiceScopeFactory scopeFactory,
        IOptionsMonitor<RmSolicitacaoStatusSyncOptions> options,
        ILogger<RmSolicitacaoStatusSyncHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var opts = _options.CurrentValue;
            var interval = TimeSpan.FromMinutes(Math.Clamp(opts.IntervalMinutes, 5, 1440));

            try
            {
                if (opts.Enabled)
                    await ProcessAllTenantsAsync(opts.MaxPerRun, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (ObjectDisposedException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RmSolicitacaoStatusSyncHostedService batch failed.");
            }

            try { await Task.Delay(interval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task ProcessAllTenantsAsync(int maxPerRun, CancellationToken ct)
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
                await ProcessTenantAsync(tenantId, maxPerRun, ct);
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

    private async Task ProcessTenantAsync(string tenantId, int maxPerRun, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantContext.SetTenantId(tenantId);

        var sync = scope.ServiceProvider.GetRequiredService<ISolicitacaoVagaRmCodStatusSyncService>();
        var result = await sync.RunBatchAsync(new RmSolicitacaoStatusSyncRequest(), maxPerRun, ct);

        if (result.Erros > 0 || result.Mensagem is not null)
        {
            _logger.LogInformation(
                "Rm CODSTATUS sync tenant {TenantId}: lidos={Total}, ok={Ok}, ign={Ign}, err={Err}, msg={Msg}",
                tenantId, result.TotalLidos, result.Atualizados, result.Ignorados, result.Erros, result.Mensagem);
        }
    }
}
