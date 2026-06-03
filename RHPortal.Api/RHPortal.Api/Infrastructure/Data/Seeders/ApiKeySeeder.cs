using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Garante API keys pré-configuradas por tenant. Útil para ambientes dev/on-prem
/// onde workers externos precisam nascer autorizados sem cadastro manual.
/// </summary>
public static class ApiKeySeeder
{
    public static async Task EnsureAsync(AppDbContext db, IConfiguration config, string tenantId, CancellationToken ct)
    {
        var seeds = config.GetSection("Seed:ApiKeys").Get<List<ApiKeySeed>>() ?? [];
        var now = DateTimeOffset.UtcNow;

        foreach (var seed in seeds.Where(x => string.Equals(x.TenantId, tenantId, StringComparison.OrdinalIgnoreCase)))
        {
            var name = (seed.Name ?? string.Empty).Trim();
            var keyHash = ResolveKeyHash(seed);

            if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(keyHash))
                continue;

            var exists = await db.ApiKeys
                .IgnoreQueryFilters()
                .AnyAsync(x => x.TenantId == tenantId && x.KeyHash == keyHash, ct);

            if (exists)
                continue;

            db.ApiKeys.Add(new ApiKey
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = name,
                KeyHash = keyHash,
                Description = string.IsNullOrWhiteSpace(seed.Description) ? null : seed.Description.Trim(),
                IsActive = seed.IsActive ?? true,
                CreatedAtUtc = now,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private static string? ResolveKeyHash(ApiKeySeed seed)
    {
        if (!string.IsNullOrWhiteSpace(seed.KeyHash))
            return seed.KeyHash.Trim().ToUpperInvariant();

        if (string.IsNullOrWhiteSpace(seed.Key))
            return null;

        var bytes = Encoding.UTF8.GetBytes(seed.Key.Trim());
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }

    private sealed class ApiKeySeed
    {
        public string? TenantId { get; set; }
        public string? Name { get; set; }
        public string? Key { get; set; }
        public string? KeyHash { get; set; }
        public string? Description { get; set; }
        public bool? IsActive { get; set; }
    }
}
