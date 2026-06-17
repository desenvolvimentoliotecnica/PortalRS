using LiotecnicaHub.Web.Domain.Entities;
using LiotecnicaHub.Web.Infrastructure.Data;
using LiotecnicaHub.Web.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LiotecnicaHub.Web.Application.Authentication;

public sealed class HubEntraConfigDto
{
    public bool IsEnabled { get; set; }
    public string? EntraTenantId { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
    public string? CallbackPath { get; set; }
    public string? HubBaseUrl { get; set; }
}

public sealed class HubEntraConfigView
{
    public bool IsEnabled { get; set; }
    public string? EntraTenantId { get; set; }
    public string? ClientId { get; set; }
    public bool HasClientSecret { get; set; }
    public string? CallbackPath { get; set; }
    public string? HubBaseUrl { get; set; }
}

public interface IHubEntraConfigService
{
    Task<HubEntraConfigView?> GetAsync(CancellationToken ct);
    Task<HubEntraConfigView> SaveAsync(HubEntraConfigDto dto, CancellationToken ct);
    Task<HubEntraConfigDto?> GetDecryptedAsync(CancellationToken ct);
    Task<string?> GetRedirectUriAsync(CancellationToken ct);
}

public sealed class HubEntraConfigService : IHubEntraConfigService
{
    private readonly HubDbContext _db;
    private readonly ISecretProtector _protector;
    private readonly ILogger<HubEntraConfigService> _logger;

    public HubEntraConfigService(
        HubDbContext db,
        ISecretProtector protector,
        ILogger<HubEntraConfigService> logger)
    {
        _db = db;
        _protector = protector;
        _logger = logger;
    }

    public async Task<HubEntraConfigView?> GetAsync(CancellationToken ct)
    {
        var entity = await _db.EntraConfigs.AsNoTracking().FirstOrDefaultAsync(ct);
        return entity is null ? null : MapView(entity);
    }

    public async Task<HubEntraConfigDto?> GetDecryptedAsync(CancellationToken ct)
    {
        var entity = await _db.EntraConfigs.AsNoTracking().FirstOrDefaultAsync(ct);
        if (entity is null) return null;

        return new HubEntraConfigDto
        {
            IsEnabled = entity.IsEnabled,
            EntraTenantId = entity.EntraTenantId,
            ClientId = entity.ClientId,
            ClientSecret = TryUnprotectClientSecret(entity.ClientSecretProtected),
            CallbackPath = entity.CallbackPath,
            HubBaseUrl = entity.HubBaseUrl
        };
    }

    public async Task<HubEntraConfigView> SaveAsync(HubEntraConfigDto dto, CancellationToken ct)
    {
        var entity = await _db.EntraConfigs.FirstOrDefaultAsync(ct);
        var now = DateTimeOffset.UtcNow;
        if (entity is null)
        {
            entity = new HubEntraConfig
            {
                Id = Guid.NewGuid(),
                CreatedAtUtc = now
            };
            _db.EntraConfigs.Add(entity);
        }

        entity.IsEnabled = dto.IsEnabled;
        entity.EntraTenantId = dto.EntraTenantId?.Trim();
        entity.ClientId = dto.ClientId?.Trim();
        entity.CallbackPath = NormalizeRedirectUri(dto.CallbackPath);
        entity.HubBaseUrl = NormalizeBaseUrl(dto.HubBaseUrl);
        entity.UpdatedAtUtc = now;

        if (!string.IsNullOrWhiteSpace(dto.ClientSecret))
            entity.ClientSecretProtected = _protector.Protect(dto.ClientSecret.Trim());

        await _db.SaveChangesAsync(ct);
        return MapView(entity);
    }

    public async Task<string?> GetRedirectUriAsync(CancellationToken ct)
    {
        var entity = await _db.EntraConfigs.AsNoTracking().FirstOrDefaultAsync(ct);
        return ResolveRedirectUri(entity?.CallbackPath);
    }

    private static HubEntraConfigView MapView(HubEntraConfig entity) => new()
    {
        IsEnabled = entity.IsEnabled,
        EntraTenantId = entity.EntraTenantId,
        ClientId = entity.ClientId,
        HasClientSecret = !string.IsNullOrWhiteSpace(entity.ClientSecretProtected),
        CallbackPath = entity.CallbackPath,
        HubBaseUrl = entity.HubBaseUrl
    };

    private static string? NormalizeRedirectUri(string? raw)
    {
        var value = raw?.Trim();
        if (string.IsNullOrWhiteSpace(value)) return null;

        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
        {
            throw new InvalidOperationException(
                "Redirect URI deve ser uma URL completa (http/https), igual à registrada no Azure AD.");
        }

        return uri.ToString().TrimEnd('/');
    }

    private static string? NormalizeBaseUrl(string? raw)
    {
        var value = raw?.Trim();
        if (string.IsNullOrWhiteSpace(value)) return null;

        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
        {
            throw new InvalidOperationException("URL base do Hub deve ser http ou https.");
        }

        return uri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
    }

    private string? TryUnprotectClientSecret(string? protectedSecret)
    {
        if (string.IsNullOrWhiteSpace(protectedSecret))
            return null;

        try
        {
            return _protector.Unprotect(protectedSecret);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Falha ao descriptografar ClientSecret do Entra. " +
                "Reconfigure o secret no Admin após redeploy ou restaure o volume de chaves DataProtection.");
            return null;
        }
    }

    private static string? ResolveRedirectUri(string? callbackPath)
    {
        var value = callbackPath?.Trim();
        if (string.IsNullOrWhiteSpace(value)) return null;

        if (Uri.TryCreate(value, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp))
            return uri.ToString().TrimEnd('/');

        return null;
    }
}
