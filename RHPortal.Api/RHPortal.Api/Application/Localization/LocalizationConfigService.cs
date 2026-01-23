using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Application.Menus;

namespace RhPortal.Api.Application.Localization;

public sealed class LocalizationConfigDto
{
    public string? Culture { get; set; }
    public string? UiCulture { get; set; }
}

public sealed class LocalizationConfigView
{
    public string? Culture { get; set; }
    public string? UiCulture { get; set; }
}

public interface ILocalizationConfigService
{
    Task<LocalizationConfigView?> GetAsync(CancellationToken ct);
    Task<LocalizationConfigView> SaveAsync(LocalizationConfigDto dto, CancellationToken ct);
    Task<(string? Culture, string? UiCulture)?> GetEffectiveAsync(CancellationToken ct);
}

public sealed class LocalizationConfigService : ILocalizationConfigService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly MenuAdministrationService _menuService;

    public LocalizationConfigService(
        AppDbContext db,
        ITenantContext tenantContext,
        MenuAdministrationService menuService)
    {
        _db = db;
        _tenantContext = tenantContext;
        _menuService = menuService;
    }

    public async Task<LocalizationConfigView?> GetAsync(CancellationToken ct)
    {
        var entity = await _db.LocalizationConfigs.AsNoTracking().FirstOrDefaultAsync(ct);
        return entity is null ? null : MapView(entity);
    }

    public async Task<(string? Culture, string? UiCulture)?> GetEffectiveAsync(CancellationToken ct)
    {
        var entity = await _db.LocalizationConfigs.AsNoTracking().FirstOrDefaultAsync(ct);
        if (entity is null)
            return null;

        var culture = NormalizeCulture(entity.Culture);
        var uiCulture = NormalizeCulture(entity.UiCulture);
        if (string.IsNullOrWhiteSpace(culture) && string.IsNullOrWhiteSpace(uiCulture))
            return null;

        if (string.IsNullOrWhiteSpace(uiCulture))
            uiCulture = culture;
        if (string.IsNullOrWhiteSpace(culture))
            culture = uiCulture;

        return (culture, uiCulture);
    }

    public async Task<LocalizationConfigView> SaveAsync(LocalizationConfigDto dto, CancellationToken ct)
    {
        var entity = await _db.LocalizationConfigs.FirstOrDefaultAsync(ct);
        var now = DateTimeOffset.UtcNow;
        if (entity is null)
        {
            entity = new LocalizationConfig
            {
                Id = Guid.NewGuid(),
                CreatedAtUtc = now
            };
            _db.LocalizationConfigs.Add(entity);
        }

        if (string.IsNullOrWhiteSpace(entity.TenantId))
            entity.TenantId = _tenantContext.TenantId ?? string.Empty;

        var culture = NormalizeCulture(dto.Culture);
        var uiCulture = NormalizeCulture(dto.UiCulture) ?? culture;

        entity.Culture = culture;
        entity.UiCulture = uiCulture;
        entity.UpdatedAtUtc = now;

        await _db.SaveChangesAsync(ct);
        await _menuService.EnsureLocalizedDisplayNamesAsync(entity.UiCulture ?? entity.Culture, ct);
        return MapView(entity);
    }

    private static LocalizationConfigView MapView(LocalizationConfig entity)
    {
        return new LocalizationConfigView
        {
            Culture = entity.Culture,
            UiCulture = entity.UiCulture
        };
    }

    private static string? NormalizeCulture(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }
}
