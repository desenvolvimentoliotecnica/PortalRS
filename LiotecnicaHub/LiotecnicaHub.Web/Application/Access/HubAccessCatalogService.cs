namespace LiotecnicaHub.Web.Application.Access;

using LiotecnicaHub.Web.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

public sealed class HubAccessCatalogSummary
{
    public int SystemCount { get; init; }
    public int ModuleCount { get; init; }
    public int PermissionCount { get; init; }
    public int ProfileCount { get; init; }
    public int UserCount { get; init; }
    public int ScopeCount { get; init; }
    public IReadOnlyList<HubSystemCatalogItem> Systems { get; init; } = [];
    public IReadOnlyList<HubProfileCatalogItem> Profiles { get; init; } = [];
}

public sealed class HubSystemCatalogItem
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int ModuleCount { get; init; }
    public int PermissionCount { get; init; }
    public int LinkedApplicationCount { get; init; }
    public IReadOnlyList<HubModuleCatalogItem> Modules { get; init; } = [];
}

public sealed class HubModuleCatalogItem
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public IReadOnlyList<HubPermissionCatalogItem> Permissions { get; init; } = [];
}

public sealed class HubPermissionCatalogItem
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
}

public sealed class HubProfileCatalogItem
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public int PermissionCount { get; init; }
    public int UserCount { get; init; }
    public IReadOnlyList<string> PermissionCodes { get; init; } = [];
}

public interface IHubAccessCatalogService
{
    Task<HubAccessCatalogSummary> GetSummaryAsync(CancellationToken ct);
    Task<IReadOnlyList<string>> GetPermissionCodesForEmailAsync(string email, CancellationToken ct);
}

public sealed class HubAccessCatalogService : IHubAccessCatalogService
{
    private readonly HubDbContext _db;

    public HubAccessCatalogService(HubDbContext db) => _db = db;

    public async Task<HubAccessCatalogSummary> GetSummaryAsync(CancellationToken ct)
    {
        var systems = await _db.Systems.AsNoTracking()
            .OrderBy(s => s.Name)
            .Select(s => new
            {
                s.Code,
                s.Name,
                ModuleCount = s.Modules.Count,
                PermissionCount = s.Permissions.Count,
                LinkedApplicationCount = s.Applications.Count,
                Modules = s.Modules
                    .OrderBy(m => m.SortOrder)
                    .Select(m => new
                    {
                        m.Code,
                        m.Name,
                        Permissions = m.Permissions
                            .OrderBy(p => p.Code)
                            .Select(p => new HubPermissionCatalogItem
                            {
                                Code = p.Code,
                                Name = p.Name
                            })
                            .ToList()
                    })
                    .ToList()
            })
            .ToListAsync(ct);

        var profiles = await _db.Profiles.AsNoTracking()
            .OrderBy(p => p.Name)
            .Select(p => new HubProfileCatalogItem
            {
                Code = p.Code,
                Name = p.Name,
                Description = p.Description,
                PermissionCount = p.ProfilePermissions.Count,
                UserCount = p.UserProfiles.Count,
                PermissionCodes = p.ProfilePermissions
                    .Select(pp => pp.Permission.Code)
                    .OrderBy(c => c)
                    .ToList()
            })
            .ToListAsync(ct);

        return new HubAccessCatalogSummary
        {
            SystemCount = await _db.Systems.CountAsync(ct),
            ModuleCount = await _db.SystemModules.CountAsync(ct),
            PermissionCount = await _db.Permissions.CountAsync(ct),
            ProfileCount = await _db.Profiles.CountAsync(ct),
            UserCount = await _db.Users.CountAsync(ct),
            ScopeCount = await _db.AccessScopes.CountAsync(ct),
            Systems = systems.Select(s => new HubSystemCatalogItem
            {
                Code = s.Code,
                Name = s.Name,
                ModuleCount = s.ModuleCount,
                PermissionCount = s.PermissionCount,
                LinkedApplicationCount = s.LinkedApplicationCount,
                Modules = s.Modules.Select(m => new HubModuleCatalogItem
                {
                    Code = m.Code,
                    Name = m.Name,
                    Permissions = m.Permissions
                }).ToList()
            }).ToList(),
            Profiles = profiles
        };
    }

    public async Task<IReadOnlyList<string>> GetPermissionCodesForEmailAsync(string email, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email))
            return [];

        email = email.Trim().ToLowerInvariant();

        return await _db.Users.AsNoTracking()
            .Where(u => u.IsActive && u.Email == email)
            .SelectMany(u => u.UserProfiles)
            .Where(up => up.Profile.IsActive)
            .SelectMany(up => up.Profile.ProfilePermissions)
            .Where(pp => pp.Permission.IsActive)
            .Select(pp => pp.Permission.Code)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync(ct);
    }
}
