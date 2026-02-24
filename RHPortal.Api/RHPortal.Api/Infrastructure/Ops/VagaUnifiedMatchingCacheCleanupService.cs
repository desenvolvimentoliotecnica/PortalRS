using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Infrastructure.Ops;

/// <summary>
/// Limpa caches de ranking não acessados há mais de 1 dia.
/// </summary>
public sealed class VagaUnifiedMatchingCacheCleanupService : BackgroundService
{
    private static readonly TimeSpan Ttl = TimeSpan.FromDays(1);
    private static readonly TimeSpan Interval = TimeSpan.FromHours(6);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<VagaUnifiedMatchingCacheCleanupService> _logger;

    public VagaUnifiedMatchingCacheCleanupService(IServiceScopeFactory scopeFactory, ILogger<VagaUnifiedMatchingCacheCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Pequeno delay inicial para não concorrer com startup
        try { await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken); } catch { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupOnceAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao limpar VagaUnifiedMatchingCaches");
            }

            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch
            {
                // stopping
            }
        }
    }

    private async Task CleanupOnceAsync(CancellationToken ct)
    {
        var cutoff = DateTimeOffset.UtcNow - Ttl;

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Ignora filtros de tenant para remover registros de qualquer tenant em uma única execução.
        var old = await db.VagaUnifiedMatchingCaches
            .IgnoreQueryFilters()
            .Where(x =>
                (x.LastAccessAtUtc.HasValue && x.LastAccessAtUtc.Value < cutoff) ||
                (!x.LastAccessAtUtc.HasValue && x.ComputedAtUtc.HasValue && x.ComputedAtUtc.Value < cutoff))
            .ToListAsync(ct);

        if (old.Count == 0) return;

        db.VagaUnifiedMatchingCaches.RemoveRange(old);
        var removed = await db.SaveChangesAsync(ct);
        _logger.LogInformation("Removidos {Count} caches antigos de matching (TTL {TtlDays}d)", removed, Ttl.TotalDays);
    }
}

