using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Authentication;

public sealed class EntraIdConfigDto
{
    public bool IsEnabled { get; set; }
    public string? EntraTenantId { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
    public string? CallbackPath { get; set; }
}

public sealed class EntraIdConfigView
{
    public bool IsEnabled { get; set; }
    public string? EntraTenantId { get; set; }
    public string? ClientId { get; set; }
    public bool HasClientSecret { get; set; }
    public string? CallbackPath { get; set; }
}

public interface IEntraIdConfigService
{
    Task<EntraIdConfigView?> GetAsync(CancellationToken ct);
    Task<EntraIdConfigView> SaveAsync(EntraIdConfigDto dto, CancellationToken ct);
    Task<EntraIdConfig?> GetEntityAsync(CancellationToken ct);
    Task<EntraIdConfigDto?> GetDecryptedAsync(CancellationToken ct);
}

public sealed class EntraIdConfigService : IEntraIdConfigService
{
    private readonly AppDbContext _db;
    private readonly ISecretProtector _protector;
    private readonly ITenantContext _tenantContext;

    public EntraIdConfigService(AppDbContext db, ISecretProtector protector, ITenantContext tenantContext)
    {
        _db = db;
        _protector = protector;
        _tenantContext = tenantContext;
    }

    public async Task<EntraIdConfigView?> GetAsync(CancellationToken ct)
    {
        var entity = await _db.EntraIdConfigs.AsNoTracking().FirstOrDefaultAsync(ct);
        return entity is null ? null : MapView(entity);
    }

    public async Task<EntraIdConfig?> GetEntityAsync(CancellationToken ct)
    {
        return await _db.EntraIdConfigs.FirstOrDefaultAsync(ct);
    }

    public async Task<EntraIdConfigDto?> GetDecryptedAsync(CancellationToken ct)
    {
        var entity = await _db.EntraIdConfigs.AsNoTracking().FirstOrDefaultAsync(ct);
        if (entity is null) return null;

        return new EntraIdConfigDto
        {
            IsEnabled = entity.IsEnabled,
            EntraTenantId = entity.EntraTenantId,
            ClientId = entity.ClientId,
            ClientSecret = string.IsNullOrWhiteSpace(entity.ClientSecretEncrypted)
                ? null
                : _protector.Decrypt(entity.ClientSecretEncrypted),
            CallbackPath = entity.CallbackPath
        };
    }

    public async Task<EntraIdConfigView> SaveAsync(EntraIdConfigDto dto, CancellationToken ct)
    {
        var entity = await _db.EntraIdConfigs.FirstOrDefaultAsync(ct);
        var now = DateTimeOffset.UtcNow;
        if (entity is null)
        {
            entity = new EntraIdConfig
            {
                Id = Guid.NewGuid(),
                CreatedAtUtc = now
            };
            _db.EntraIdConfigs.Add(entity);
        }

        if (string.IsNullOrWhiteSpace(entity.TenantId))
            entity.TenantId = _tenantContext.TenantId ?? string.Empty;

        entity.IsEnabled = dto.IsEnabled;
        entity.EntraTenantId = dto.EntraTenantId?.Trim();
        entity.ClientId = dto.ClientId?.Trim();
        entity.CallbackPath = dto.CallbackPath?.Trim();
        entity.UpdatedAtUtc = now;

        if (!string.IsNullOrWhiteSpace(dto.ClientSecret))
            entity.ClientSecretEncrypted = _protector.Encrypt(dto.ClientSecret.Trim());

        await _db.SaveChangesAsync(ct);
        return MapView(entity);
    }

    private static EntraIdConfigView MapView(EntraIdConfig entity)
    {
        return new EntraIdConfigView
        {
            IsEnabled = entity.IsEnabled,
            EntraTenantId = entity.EntraTenantId,
            ClientId = entity.ClientId,
            HasClientSecret = !string.IsNullOrWhiteSpace(entity.ClientSecretEncrypted),
            CallbackPath = entity.CallbackPath
        };
    }
}
