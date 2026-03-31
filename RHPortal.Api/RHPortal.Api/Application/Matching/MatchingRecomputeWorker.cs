using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Matching;

public sealed class MatchingRecomputeWorker : BackgroundService
{
    private readonly MatchingRecomputeQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MatchingRecomputeWorker> _logger;

    public MatchingRecomputeWorker(
        MatchingRecomputeQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<MatchingRecomputeWorker> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("MatchingRecomputeWorker started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                while (await _queue.Reader.WaitToReadAsync(stoppingToken))
                {
                    while (_queue.Reader.TryRead(out var request))
                    {
                        await ProcessRequestAsync(request, stoppingToken);
                    }
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "MatchingRecomputeWorker loop error.");
                await Task.Delay(1000, stoppingToken);
            }
        }

        _logger.LogInformation("MatchingRecomputeWorker stopped.");
    }

    private async Task ProcessRequestAsync(MatchingRecomputeRequest request, CancellationToken ct)
    {
        var startedAt = DateTimeOffset.UtcNow;

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var tenantCtx = scope.ServiceProvider.GetRequiredService<ITenantContext>();
            if (!string.IsNullOrWhiteSpace(request.TenantId))
                tenantCtx.SetTenantId(request.TenantId);

            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var aiClient = scope.ServiceProvider.GetService<IRHPortalAiMatchClient>();

            if (aiClient is null)
            {
                await SetFailedAsync(db, request.VagaId, request.FiltersHash, "RHPortal.Ai não configurado.", ct);
                return;
            }

            var unified = await aiClient.RunUnifiedMatchingAsync(
                request.VagaId, request.TenantId, minScore: 0, take: request.Take, ct: ct);

            if (unified is null)
            {
                await SetFailedAsync(db, request.VagaId, request.FiltersHash,
                    "RHPortal.Ai indisponível ou falha ao calcular matching.", ct);
                return;
            }

            // Persistir sub-scores na tabela relacional
            var scoreService = scope.ServiceProvider.GetRequiredService<ICandidatoVagaMatchingScoreService>();
            await scoreService.ReplaceScoresForVagaAsync(request.VagaId, unified, request.TenantId, ct);

            var now = DateTimeOffset.UtcNow;

            var cache = await db.VagaUnifiedMatchingCaches
                .AsTracking()
                .FirstOrDefaultAsync(x => x.VagaId == request.VagaId, ct);

            if (cache is null)
            {
                cache = new VagaUnifiedMatchingCache
                {
                    VagaId = request.VagaId,
                    TenantId = request.TenantId,
                };
                db.VagaUnifiedMatchingCaches.Add(cache);
            }

            cache.ItemsJson = null;
            cache.Status = UnifiedMatchingCacheStatus.Ready;
            cache.CurrentFiltersHash = request.FiltersHash;
            cache.PendingFiltersHash = null;
            cache.ComputedAtUtc = now;
            cache.LastError = null;

            await db.SaveChangesAsync(ct);

            var elapsed = DateTimeOffset.UtcNow - startedAt;
            _logger.LogInformation(
                "Unified matching recompute ready. Tenant={TenantId} VagaId={VagaId} Rule={RuleVersion} Take={Take} Items={Items} ElapsedMs={ElapsedMs}",
                request.TenantId,
                request.VagaId,
                request.RuleVersion,
                request.Take,
                unified.Count,
                (long)elapsed.TotalMilliseconds);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao recalcular ranking unificado da vaga {VagaId}", request.VagaId);
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var tenantCtx = scope.ServiceProvider.GetRequiredService<ITenantContext>();
                if (!string.IsNullOrWhiteSpace(request.TenantId))
                    tenantCtx.SetTenantId(request.TenantId);
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                await SetFailedAsync(db, request.VagaId, request.FiltersHash,
                    "Erro ao recalcular ranking (ver logs).", CancellationToken.None);
            }
            catch
            {
                // best-effort
            }
        }
    }

    private static async Task SetFailedAsync(AppDbContext db, Guid vagaId, string filtersHash, string message, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var cache = await db.VagaUnifiedMatchingCaches
            .AsTracking()
            .FirstOrDefaultAsync(x => x.VagaId == vagaId, ct);

        if (cache is null) return;

        cache.Status = UnifiedMatchingCacheStatus.Failed;
        cache.PendingFiltersHash = filtersHash;
        cache.StartedAtUtc ??= now;
        cache.LastError = message;
        await db.SaveChangesAsync(ct);
    }
}
