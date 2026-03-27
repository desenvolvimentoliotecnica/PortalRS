using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RhPortal.Api.Contracts.Matching;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Configuration;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Matching;

public sealed class VagaUnifiedMatchingCacheService : IVagaUnifiedMatchingCacheService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly TimeSpan RecomputeStuckTimeout = TimeSpan.FromMinutes(15);

    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<VagaUnifiedMatchingCacheService> _logger;
    private readonly RhAiOptions _rhAiOptions;

    public VagaUnifiedMatchingCacheService(
        AppDbContext db,
        ITenantContext tenantContext,
        IServiceScopeFactory scopeFactory,
        ILogger<VagaUnifiedMatchingCacheService> logger,
        IOptions<RhAiOptions> rhAiOptions)
    {
        _db = db;
        _tenantContext = tenantContext;
        _scopeFactory = scopeFactory;
        _logger = logger;
        _rhAiOptions = rhAiOptions.Value;
    }

    public Task<VagaUnifiedMatchingRankingSnapshot> GetOrStartAsync(Guid vagaId, int take = 100, CancellationToken ct = default)
        => GetOrStartInternalAsync(vagaId, take, invalidate: false, ct);

    public Task<VagaUnifiedMatchingRankingSnapshot> InvalidateAndStartAsync(Guid vagaId, int take = 100, CancellationToken ct = default)
        => GetOrStartInternalAsync(vagaId, take, invalidate: true, ct);

    private async Task<VagaUnifiedMatchingRankingSnapshot> GetOrStartInternalAsync(
        Guid vagaId,
        int take,
        bool invalidate,
        CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? string.Empty;
        var ruleVersion = _rhAiOptions.ResolveRuleVersion(tenantId);
        var now = DateTimeOffset.UtcNow;
        var safeTake = Math.Clamp(take, 10, 100);

        var vaga = await _db.Vagas
            .AsNoTracking()
            .Where(v => v.Id == vagaId)
            .Select(v => new { v.Id, v.MatchingFiltrosRaw, v.PesoCompetencia, v.PesoExperiencia, v.PesoFormacao, v.PesoLocalidade })
            .FirstOrDefaultAsync(ct);

        if (vaga is null)
        {
            return new VagaUnifiedMatchingRankingSnapshot(
                Status: UnifiedMatchingCacheStatus.Failed,
                FiltersHash: string.Empty,
                StartedAtUtc: null,
                ComputedAtUtc: null,
                Items: Array.Empty<MatchingCandidateItemResponse>(),
                StaleItems: Array.Empty<MatchingCandidateItemResponse>(),
                LastError: "Vaga não encontrada."
            );
        }

        var desiredHash = ComputeFiltersHash(vaga.MatchingFiltrosRaw, ruleVersion, vaga.PesoCompetencia, vaga.PesoExperiencia, vaga.PesoFormacao, vaga.PesoLocalidade);
        var cache = await _db.VagaUnifiedMatchingCaches
            .AsTracking()
            .FirstOrDefaultAsync(x => x.VagaId == vagaId, ct);

        IReadOnlyList<MatchingCandidateItemResponse> staleItems = Array.Empty<MatchingCandidateItemResponse>();
        if (cache?.ItemsJson is { Length: > 0 })
            staleItems = TryDeserializeItems(cache.ItemsJson) ?? Array.Empty<MatchingCandidateItemResponse>();

        if (cache is null)
        {
            cache = new VagaUnifiedMatchingCache
            {
                VagaId = vagaId,
                TenantId = tenantId,
                Status = UnifiedMatchingCacheStatus.Processing,
                PendingFiltersHash = desiredHash,
                CurrentFiltersHash = string.Empty,
                StartedAtUtc = now,
                ComputedAtUtc = null,
                LastAccessAtUtc = now,
                ItemsJson = null,
                LastError = null,
            };
            _db.VagaUnifiedMatchingCaches.Add(cache);
            await _db.SaveChangesAsync(ct);

            StartBackgroundRecompute(vagaId, tenantId, desiredHash, safeTake, ruleVersion);
            return new VagaUnifiedMatchingRankingSnapshot(
                Status: UnifiedMatchingCacheStatus.Processing,
                FiltersHash: desiredHash,
                StartedAtUtc: cache.StartedAtUtc,
                ComputedAtUtc: cache.ComputedAtUtc,
                Items: Array.Empty<MatchingCandidateItemResponse>(),
                StaleItems: Array.Empty<MatchingCandidateItemResponse>(),
                LastError: null
            );
        }

        cache.LastAccessAtUtc = now;

        var isReadyForDesiredHash =
            cache.Status == UnifiedMatchingCacheStatus.Ready &&
            string.Equals(cache.CurrentFiltersHash, desiredHash, StringComparison.OrdinalIgnoreCase) &&
            cache.ItemsJson is { Length: > 0 };

        if (!invalidate && isReadyForDesiredHash)
        {
            await _db.SaveChangesAsync(ct);
            var items = TryDeserializeItems(cache.ItemsJson!) ?? Array.Empty<MatchingCandidateItemResponse>();
            return new VagaUnifiedMatchingRankingSnapshot(
                Status: UnifiedMatchingCacheStatus.Ready,
                FiltersHash: desiredHash,
                StartedAtUtc: cache.StartedAtUtc,
                ComputedAtUtc: cache.ComputedAtUtc,
                Items: items,
                StaleItems: Array.Empty<MatchingCandidateItemResponse>(),
                LastError: null
            );
        }

        var alreadyProcessingSameHash =
            cache.Status == UnifiedMatchingCacheStatus.Processing &&
            string.Equals(cache.PendingFiltersHash, desiredHash, StringComparison.OrdinalIgnoreCase) &&
            cache.StartedAtUtc.HasValue &&
            (now - cache.StartedAtUtc.Value) < RecomputeStuckTimeout;

        if (!alreadyProcessingSameHash)
        {
            cache.Status = UnifiedMatchingCacheStatus.Processing;
            cache.PendingFiltersHash = desiredHash;
            cache.StartedAtUtc = now;
            cache.LastError = null;
            await _db.SaveChangesAsync(ct);

            StartBackgroundRecompute(vagaId, tenantId, desiredHash, safeTake, ruleVersion);
        }
        else
        {
            await _db.SaveChangesAsync(ct);
        }

        // Enquanto processa, devolve stale (se existir) + status
        if (cache.Status == UnifiedMatchingCacheStatus.Failed && string.Equals(cache.PendingFiltersHash, desiredHash, StringComparison.OrdinalIgnoreCase))
        {
            return new VagaUnifiedMatchingRankingSnapshot(
                Status: UnifiedMatchingCacheStatus.Failed,
                FiltersHash: desiredHash,
                StartedAtUtc: cache.StartedAtUtc,
                ComputedAtUtc: cache.ComputedAtUtc,
                Items: Array.Empty<MatchingCandidateItemResponse>(),
                StaleItems: staleItems,
                LastError: cache.LastError
            );
        }

        return new VagaUnifiedMatchingRankingSnapshot(
            Status: UnifiedMatchingCacheStatus.Processing,
            FiltersHash: desiredHash,
            StartedAtUtc: cache.StartedAtUtc,
            ComputedAtUtc: cache.ComputedAtUtc,
            Items: Array.Empty<MatchingCandidateItemResponse>(),
            StaleItems: staleItems,
            LastError: null
        );
    }

    private void StartBackgroundRecompute(Guid vagaId, string tenantId, string filtersHash, int take, string ruleVersion)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                var startedAt = DateTimeOffset.UtcNow;
                using var scope = _scopeFactory.CreateScope();
                var tenantCtx = scope.ServiceProvider.GetRequiredService<ITenantContext>();
                if (!string.IsNullOrWhiteSpace(tenantId))
                    tenantCtx.SetTenantId(tenantId);

                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var aiClient = scope.ServiceProvider.GetService<IRHPortalAiMatchClient>();
                if (aiClient is null)
                {
                    await SetFailedAsync(db, vagaId, filtersHash, "RHPortal.Ai não configurado.", CancellationToken.None);
                    return;
                }

                var unified = await aiClient.RunUnifiedMatchingAsync(vagaId, tenantId, minScore: 0, take: take, ct: CancellationToken.None)
                    .ConfigureAwait(false);

                if (unified is null)
                {
                    await SetFailedAsync(db, vagaId, filtersHash, "RHPortal.Ai indisponível ou falha ao calcular matching.", CancellationToken.None);
                    return;
                }

                var json = JsonSerializer.Serialize(unified, JsonOptions);
                var now = DateTimeOffset.UtcNow;

                var cache = await db.VagaUnifiedMatchingCaches
                    .AsTracking()
                    .FirstOrDefaultAsync(x => x.VagaId == vagaId, CancellationToken.None);

                if (cache is null)
                {
                    cache = new VagaUnifiedMatchingCache
                    {
                        VagaId = vagaId,
                        TenantId = tenantId,
                    };
                    db.VagaUnifiedMatchingCaches.Add(cache);
                }

                cache.ItemsJson = json;
                cache.Status = UnifiedMatchingCacheStatus.Ready;
                cache.CurrentFiltersHash = filtersHash;
                cache.PendingFiltersHash = null;
                cache.ComputedAtUtc = now;
                cache.LastError = null;

                await db.SaveChangesAsync(CancellationToken.None).ConfigureAwait(false);
                var elapsed = DateTimeOffset.UtcNow - startedAt;
                _logger.LogInformation(
                    "Unified matching recompute ready. Tenant={TenantId} VagaId={VagaId} Rule={RuleVersion} Take={Take} Items={Items} ElapsedMs={ElapsedMs}",
                    tenantId,
                    vagaId,
                    ruleVersion,
                    take,
                    unified.Count,
                    (long)elapsed.TotalMilliseconds
                );
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao recalcular ranking unificado da vaga {VagaId}", vagaId);
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var tenantCtx = scope.ServiceProvider.GetRequiredService<ITenantContext>();
                    if (!string.IsNullOrWhiteSpace(tenantId))
                        tenantCtx.SetTenantId(tenantId);
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    await SetFailedAsync(db, vagaId, filtersHash, "Erro ao recalcular ranking (ver logs).", CancellationToken.None);
                }
                catch
                {
                    // best-effort
                }
            }
        }, CancellationToken.None);
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

    private static IReadOnlyList<MatchingCandidateItemResponse>? TryDeserializeItems(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<MatchingCandidateItemResponse>>(json, JsonOptions);
        }
        catch
        {
            return null;
        }
    }

    private static string ComputeFiltersHash(string? raw, string? ruleVersion, int wC = 40, int wE = 30, int wF = 15, int wL = 15)
    {
        var normalized = $"{NormalizeFiltersText(raw)}|rule:{(ruleVersion ?? string.Empty).Trim()}|w:{wC},{wE},{wF},{wL}";
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(normalized));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string NormalizeFiltersText(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        var s = raw.Trim();
        s = s.Replace("\r\n", "\n").Replace("\r", "\n");
        s = Regex.Replace(s, @"[ \t\f\v]+", " ");
        s = Regex.Replace(s, @"\n{3,}", "\n\n");
        return s.Trim();
    }
}

