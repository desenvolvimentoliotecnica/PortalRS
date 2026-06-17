using LiotecnicaHub.Web.Application.Access.Contracts;
using LiotecnicaHub.Web.Domain.Entities;
using LiotecnicaHub.Web.Domain.Enums;
using LiotecnicaHub.Web.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace LiotecnicaHub.Web.Application.Access;

public interface IHubUserProvisioningService
{
    Task<HubUser> EnsureUserAsync(string email, string? displayName, CancellationToken ct);
}

public sealed class HubUserProvisioningService : IHubUserProvisioningService
{
    private readonly HubDbContext _db;

    public HubUserProvisioningService(HubDbContext db) => _db = db;

    public async Task<HubUser> EnsureUserAsync(string email, string? displayName, CancellationToken ct)
    {
        email = email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        var now = DateTimeOffset.UtcNow;

        if (user is null)
        {
            user = new HubUser
            {
                Id = Guid.NewGuid(),
                Email = email,
                Name = string.IsNullOrWhiteSpace(displayName) ? email.Split('@')[0] : displayName.Trim(),
                IsActive = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync(ct);
            return user;
        }

        if (!string.IsNullOrWhiteSpace(displayName)
            && !string.Equals(user.Name, displayName.Trim(), StringComparison.Ordinal))
        {
            user.Name = displayName.Trim();
            user.UpdatedAtUtc = now;
            await _db.SaveChangesAsync(ct);
        }

        return user;
    }
}

public interface IHubAccessService
{
    Task<HubAuthMeResponse?> GetMeAsync(string email, CancellationToken ct);
    Task<HubMinhasPermissoesResponse?> GetMinhasPermissoesAsync(string email, CancellationToken ct);
    Task<HubVerificarPermissaoResponse> VerificarPermissaoAsync(string email, string permissionCode, CancellationToken ct);
    Task<IReadOnlyList<HubMeuSistemaDto>> GetMeusSistemasAsync(string email, CancellationToken ct);
    Task<bool> PossuiPermissaoAsync(string email, string permissionCode, CancellationToken ct);
    Task<IReadOnlyList<string>> GetProfileCodesAsync(string email, CancellationToken ct);
}

public sealed class HubAccessService : IHubAccessService
{
    public const string HubAppsVisualizar = "hub.aplicativos.visualizar";

    private readonly HubDbContext _db;

    public HubAccessService(HubDbContext db) => _db = db;

    public async Task<HubAuthMeResponse?> GetMeAsync(string email, CancellationToken ct)
    {
        var user = await FindActiveUserAsync(email, ct);
        if (user is null) return null;

        var profiles = await GetProfileCodesAsync(email, ct);
        return new HubAuthMeResponse(user.Id, user.Name, user.Email, profiles);
    }

    public async Task<HubMinhasPermissoesResponse?> GetMinhasPermissoesAsync(string email, CancellationToken ct)
    {
        var user = await FindActiveUserAsync(email, ct);
        if (user is null) return null;

        var permissoes = await ResolvePermissionCodesAsync(user.Id, ct);
        var escopos = await ResolveScopesAsync(user.Id, ct);

        return new HubMinhasPermissoesResponse(user.Id, permissoes, escopos);
    }

    public async Task<HubVerificarPermissaoResponse> VerificarPermissaoAsync(
        string email,
        string permissionCode,
        CancellationToken ct)
    {
        var permitido = await PossuiPermissaoAsync(email, permissionCode, ct);
        return new HubVerificarPermissaoResponse(permitido);
    }

    public async Task<IReadOnlyList<HubMeuSistemaDto>> GetMeusSistemasAsync(string email, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email))
            return [];

        email = email.Trim().ToLowerInvariant();
        var user = await FindActiveUserAsync(email, ct);

        if (user is null)
            return [];

        var permissoes = await ResolvePermissionCodesAsync(user.Id, ct);
        if (!permissoes.Contains(HubAppsVisualizar, StringComparer.OrdinalIgnoreCase))
            return [];

        var systemCodes = permissoes
            .Select(p => p.Split('.', 2, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault())
            .Where(c => !string.IsNullOrWhiteSpace(c) && !string.Equals(c, "hub", StringComparison.OrdinalIgnoreCase))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (systemCodes.Count == 0)
            return [];

        return await _db.Systems.AsNoTracking()
            .Where(s => s.IsActive && systemCodes.Contains(s.Code))
            .OrderBy(s => s.Name)
            .Select(s => new HubMeuSistemaDto(
                s.Code,
                s.Name,
                s.Description,
                s.Url,
                s.IconKey,
                false))
            .ToListAsync(ct);
    }

    public async Task<bool> PossuiPermissaoAsync(string email, string permissionCode, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(permissionCode))
            return false;

        var user = await FindActiveUserAsync(email, ct);
        if (user is null) return false;

        permissionCode = permissionCode.Trim().ToLowerInvariant();
        var permissoes = await ResolvePermissionCodesAsync(user.Id, ct);

        return permissoes.Any(p => PermissionMatches(p, permissionCode));
    }

    public async Task<IReadOnlyList<string>> GetProfileCodesAsync(string email, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email))
            return [];

        email = email.Trim().ToLowerInvariant();

        return await _db.Users.AsNoTracking()
            .Where(u => u.IsActive && u.Email == email)
            .SelectMany(u => u.UserProfiles)
            .Where(up => up.Profile.IsActive)
            .Select(up => up.Profile.Code)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync(ct);
    }

    internal static bool PermissionMatches(string granted, string required)
    {
        granted = granted.Trim().ToLowerInvariant();
        required = required.Trim().ToLowerInvariant();

        if (granted == required)
            return true;

        if (!granted.EndsWith(".*", StringComparison.Ordinal))
            return false;

        var prefix = granted[..^1];
        return required.StartsWith(prefix, StringComparison.Ordinal);
    }

    private async Task<HubUser?> FindActiveUserAsync(string email, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email))
            return null;

        email = email.Trim().ToLowerInvariant();
        return await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.IsActive && u.Email == email, ct);
    }

    private async Task<IReadOnlyList<string>> ResolvePermissionCodesAsync(Guid userId, CancellationToken ct) =>
        await _db.Users.AsNoTracking()
            .Where(u => u.Id == userId && u.IsActive)
            .SelectMany(u => u.UserProfiles)
            .Where(up => up.Profile.IsActive)
            .SelectMany(up => up.Profile.ProfilePermissions)
            .Where(pp => pp.Permission.IsActive)
            .Select(pp => pp.Permission.Code)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync(ct);

    private async Task<IReadOnlyList<HubAccessScopeDto>> ResolveScopesAsync(Guid userId, CancellationToken ct) =>
        await _db.UserProfileScopes.AsNoTracking()
            .Where(ups => ups.UserId == userId && ups.Scope.IsActive)
            .Select(ups => new HubAccessScopeDto(
                ups.Scope.ScopeType.ToString().ToLowerInvariant(),
                ups.Scope.ExternalCode ?? string.Empty,
                ups.Scope.Name))
            .Distinct()
            .ToListAsync(ct);
}
