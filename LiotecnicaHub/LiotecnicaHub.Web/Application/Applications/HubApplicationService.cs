using LiotecnicaHub.Web.Application.Access;
using LiotecnicaHub.Web.Domain.Entities;
using LiotecnicaHub.Web.Domain.Enums;
using LiotecnicaHub.Web.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace LiotecnicaHub.Web.Application.Applications;

public interface IHubApplicationService
{
    Task<IReadOnlyList<HubApplication>> GetVisibleForUserAsync(string? email, CancellationToken ct);
    Task<IReadOnlyList<HubApplication>> GetAllAsync(CancellationToken ct);
    Task<HubApplication?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<HubApplication> CreateAsync(HubApplication app, CancellationToken ct);
    Task UpdateAsync(HubApplication app, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
}

public sealed class HubApplicationService : IHubApplicationService
{
    private readonly HubDbContext _db;
    private readonly IHubAccessService _access;

    public HubApplicationService(HubDbContext db, IHubAccessService access)
    {
        _db = db;
        _access = access;
    }

    public async Task<IReadOnlyList<HubApplication>> GetVisibleForUserAsync(string? email, CancellationToken ct)
    {
        var apps = await _db.Applications
            .AsNoTracking()
            .Include(a => a.AccessRules)
            .Include(a => a.System)
            .Where(a => a.IsActive)
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.Name)
            .ToListAsync(ct);

        if (string.IsNullOrWhiteSpace(email))
            return Array.Empty<HubApplication>();

        email = email.Trim().ToLowerInvariant();

        var hasIamProfiles = await _db.UserProfiles.AsNoTracking()
            .AnyAsync(up => up.User.IsActive && up.User.Email == email && up.Profile.IsActive, ct);

        if (!hasIamProfiles)
            return apps.Where(a => IsVisibleToUser(a, email)).ToList();

        if (!await _access.PossuiPermissaoAsync(email, HubAccessService.HubAppsVisualizar, ct))
            return Array.Empty<HubApplication>();

        var permissoes = await _access.GetMinhasPermissoesAsync(email, ct);
        var systemCodes = (permissoes?.Permissoes ?? [])
            .Select(p => p.Split('.', 2, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault())
            .Where(c => !string.IsNullOrWhiteSpace(c)
                && !string.Equals(c, "hub", StringComparison.OrdinalIgnoreCase))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return apps.Where(a =>
            a.SystemId is null
            || (a.System is not null && systemCodes.Contains(a.System.Code))).ToList();
    }

    public async Task<IReadOnlyList<HubApplication>> GetAllAsync(CancellationToken ct) =>
        await _db.Applications
            .AsNoTracking()
            .Include(a => a.AccessRules)
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.Name)
            .ToListAsync(ct);

    public async Task<HubApplication?> GetByIdAsync(Guid id, CancellationToken ct) =>
        await _db.Applications
            .Include(a => a.AccessRules)
            .FirstOrDefaultAsync(a => a.Id == id, ct);

    public async Task<HubApplication> CreateAsync(HubApplication app, CancellationToken ct)
    {
        app.Id = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        app.CreatedAtUtc = now;
        app.UpdatedAtUtc = now;
        _db.Applications.Add(app);
        await _db.SaveChangesAsync(ct);
        return app;
    }

    public async Task UpdateAsync(HubApplication app, CancellationToken ct)
    {
        app.UpdatedAtUtc = DateTimeOffset.UtcNow;
        _db.Applications.Update(app);
        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Applications.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (entity is null) return;
        _db.Applications.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }

    internal static bool IsVisibleToUser(HubApplication app, string email)
    {
        var rules = app.AccessRules;
        if (rules.Count == 0) return true;

        if (rules.Any(r => r.RuleType == HubAccessRuleType.DenyAll)) return false;
        if (rules.Any(r => r.RuleType == HubAccessRuleType.AllowAll)) return true;

        foreach (var rule in rules)
        {
            if (rule.RuleType == HubAccessRuleType.DenyEmail
                && string.Equals(rule.Value?.Trim(), email, StringComparison.OrdinalIgnoreCase))
                return false;

            if (rule.RuleType == HubAccessRuleType.DenyDomain
                && MatchesDomain(email, rule.Value))
                return false;
        }

        var allowRules = rules.Where(r =>
            r.RuleType is HubAccessRuleType.AllowEmail or HubAccessRuleType.AllowDomain).ToList();
        if (allowRules.Count == 0) return true;

        return allowRules.Any(rule =>
            rule.RuleType == HubAccessRuleType.AllowEmail
                && string.Equals(rule.Value?.Trim(), email, StringComparison.OrdinalIgnoreCase)
            || rule.RuleType == HubAccessRuleType.AllowDomain
                && MatchesDomain(email, rule.Value));
    }

    private static bool MatchesDomain(string email, string? domain)
    {
        if (string.IsNullOrWhiteSpace(domain)) return false;
        var normalized = domain.Trim().ToLowerInvariant();
        if (!normalized.StartsWith('@')) normalized = "@" + normalized;
        return email.EndsWith(normalized, StringComparison.OrdinalIgnoreCase);
    }
}
