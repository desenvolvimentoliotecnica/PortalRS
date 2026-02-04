using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Npgsql;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Talentos;

public sealed class CvImportWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<CvImportWorker> _logger;
    private const int PollIntervalSeconds = 15;
    private const int BatchSize = 5;

    public CvImportWorker(IServiceScopeFactory scopeFactory, ILogger<CvImportWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("CvImportWorker started; polling every {Seconds}s.", PollIntervalSeconds);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (ObjectDisposedException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CvImportWorker failed.");
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(PollIntervalSeconds), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task ProcessBatchAsync(CancellationToken ct)
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
                using var scope = _scopeFactory.CreateScope();
                var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
                tenantContext.SetTenantId(tenantId);
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var talentoService = scope.ServiceProvider.GetRequiredService<ITalentoService>();

                var pendingJobIds = await db.TalentoCvImportJobs
                    .AsNoTracking()
                    .Where(j => j.Status == CvImportStatus.Pendente)
                    .OrderBy(j => j.CreatedAtUtc)
                    .Take(BatchSize)
                    .Select(j => j.Id)
                    .ToListAsync(ct);
                foreach (var jobId in pendingJobIds)
                {
                    try
                    {
                        await talentoService.ProcessImportJobAsync(jobId, ct);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "CvImportWorker: failed to process job {JobId} for tenant {TenantId}.", jobId, tenantId);
                    }
                }
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01")
            {
                _logger.LogWarning("Tenant {TenantId}: schema missing (TalentoCvImportJobs). Run migrations.", tenantId);
            }
        }
    }
}
