namespace LiotecnicaHub.Web.Application.Access;

using LiotecnicaHub.Web.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

public sealed class HubAccessCatalogSummary
{
    public int SystemCount { get; init; }
    public int HubAdminPermissionCount { get; init; }
    public int ProfileCount { get; init; }
    public int UserCount { get; init; }
    public int ProfileSystemLinkCount { get; init; }
    public IReadOnlyList<HubSystemCatalogItem> Systems { get; init; } = [];
    public IReadOnlyList<HubProfileCatalogItem> Profiles { get; init; } = [];
}

public sealed class HubSystemCatalogItem
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int LinkedApplicationCount { get; init; }
    public int ProfileAccessCount { get; init; }
}

public sealed class HubProfileCatalogItem
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public int SystemAccessCount { get; init; }
    public int HubAdminPermissionCount { get; init; }
    public int UserCount { get; init; }
    public IReadOnlyList<string> SystemCodes { get; init; } = [];
    public IReadOnlyList<string> HubAdminPermissionCodes { get; init; } = [];
}

public interface IHubAccessCatalogService
{
    Task<HubAccessCatalogSummary> GetSummaryAsync(CancellationToken ct);
    Task<IReadOnlyList<string>> GetAccessibleSystemCodesForEmailAsync(string email, CancellationToken ct);
}

public sealed class HubAccessCatalogService : IHubAccessCatalogService
{
    private readonly HubDbContext _db;

    public HubAccessCatalogService(HubDbContext db) => _db = db;

    public async Task<HubAccessCatalogSummary> GetSummaryAsync(CancellationToken ct)
    {
        var systems = await _db.Systems.AsNoTracking()
            .OrderBy(s => s.Name)
            .Select(s => new HubSystemCatalogItem
            {
                Code = s.Code,
                Name = s.Name,
                LinkedApplicationCount = s.Applications.Count,
                ProfileAccessCount = s.ProfileSystemAccesses.Count
            })
            .ToListAsync(ct);

        var profiles = await _db.Profiles.AsNoTracking()
            .OrderBy(p => p.Name)
            .Select(p => new HubProfileCatalogItem
            {
                Code = p.Code,
                Name = p.Name,
                Description = p.Description,
                SystemAccessCount = p.ProfileSystemAccesses.Count,
                HubAdminPermissionCount = p.ProfilePermissions.Count(pp => pp.Permission.Code.StartsWith("hub.")),
                UserCount = p.UserProfiles.Count,
                SystemCodes = p.ProfileSystemAccesses
                    .Select(psa => psa.System.Code)
                    .OrderBy(c => c)
                    .ToList(),
                HubAdminPermissionCodes = p.ProfilePermissions
                    .Where(pp => pp.Permission.Code.StartsWith("hub."))
                    .Select(pp => pp.Permission.Code)
                    .OrderBy(c => c)
                    .ToList()
            })
            .ToListAsync(ct);

        return new HubAccessCatalogSummary
        {
            SystemCount = await _db.Systems.CountAsync(ct),
            HubAdminPermissionCount = await _db.Permissions.CountAsync(p => p.IsActive && p.Code.StartsWith("hub."), ct),
            ProfileCount = await _db.Profiles.CountAsync(ct),
            UserCount = await _db.Users.CountAsync(ct),
            ProfileSystemLinkCount = await _db.ProfileSystemAccesses.CountAsync(ct),
            Systems = systems,
            Profiles = profiles
        };
    }

    public async Task<IReadOnlyList<string>> GetAccessibleSystemCodesForEmailAsync(string email, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email))
            return [];

        email = email.Trim().ToLowerInvariant();

        return await _db.Users.AsNoTracking()
            .Where(u => u.IsActive && u.Email == email)
            .SelectMany(u => u.UserProfiles)
            .Where(up => up.Profile.IsActive)
            .SelectMany(up => up.Profile.ProfileSystemAccesses)
            .Where(psa => psa.System.IsActive)
            .Select(psa => psa.System.Code)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync(ct);
    }
}
