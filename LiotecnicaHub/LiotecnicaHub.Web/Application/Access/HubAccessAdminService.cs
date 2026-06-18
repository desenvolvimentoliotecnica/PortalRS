using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using LiotecnicaHub.Web.Application.Authentication;
using LiotecnicaHub.Web.Domain;
using LiotecnicaHub.Web.Domain.Entities;
using LiotecnicaHub.Web.Domain.Enums;
using LiotecnicaHub.Web.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace LiotecnicaHub.Web.Application.Access;

public sealed class HubAccessAdminService : IHubAccessAdminService
{
    private static readonly JsonSerializerOptions AuditJsonOptions = new() { WriteIndented = false };

    private readonly HubDbContext _db;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HubAccessAdminService(HubDbContext db, IHttpContextAccessor httpContextAccessor)
    {
        _db = db;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task<IReadOnlyList<HubUserListItem>> ListUsersAsync(string? search, CancellationToken ct)
    {
        var query = _db.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(u =>
                u.Email.Contains(term)
                || u.Name.ToLower().Contains(term));
        }

        return await query
            .OrderBy(u => u.Name)
            .Select(u => new HubUserListItem
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                IsActive = u.IsActive,
                ProfileCount = u.UserProfiles.Count(up => up.Profile.IsActive),
                ProfileNames = u.UserProfiles
                    .Where(up => up.Profile.IsActive)
                    .Select(up => up.Profile.Name)
                    .OrderBy(n => n)
                    .ToList(),
                UpdatedAtUtc = u.UpdatedAtUtc
            })
            .ToListAsync(ct);
    }

    public async Task<HubUserInput?> GetUserAsync(Guid id, CancellationToken ct)
    {
        var user = await _db.Users.AsNoTracking()
            .Include(u => u.UserProfiles)
            .FirstOrDefaultAsync(u => u.Id == id, ct);

        if (user is null) return null;

        return new HubUserInput
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            IsActive = user.IsActive,
            SelectedProfileIds = user.UserProfiles.Select(up => up.ProfileId).ToList()
        };
    }

    public async Task<(bool Success, string? Error)> CreateUserAsync(HubUserInput input, CancellationToken ct)
    {
        var email = NormalizeEmail(input.Email);
        if (string.IsNullOrWhiteSpace(email))
            return (false, "Informe um e-mail válido.");

        if (string.IsNullOrWhiteSpace(input.Name?.Trim()))
            return (false, "Informe o nome do usuário.");

        if (await _db.Users.AnyAsync(u => u.Email == email, ct))
            return (false, "Já existe um usuário com este e-mail.");

        var profileIds = await ValidateProfileIdsAsync(input.SelectedProfileIds, ct);
        if (profileIds.Error is not null)
            return (false, profileIds.Error);

        var now = DateTimeOffset.UtcNow;
        var actorId = GetCurrentActorUserId();

        var user = new HubUser
        {
            Id = Guid.NewGuid(),
            Name = input.Name.Trim(),
            Email = email,
            IsActive = input.IsActive,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        _db.Users.Add(user);

        foreach (var profileId in profileIds.Ids)
        {
            _db.UserProfiles.Add(new HubUserProfile
            {
                UserId = user.Id,
                ProfileId = profileId,
                CreatedAtUtc = now,
                CreatedByUserId = actorId
            });
        }

        await WriteAuditAsync(
            HubAccessAuditAction.UserCreated,
            user.Id,
            null,
            null,
            actorId,
            null,
            SerializeAudit(new { user.Email, user.Name, Profiles = profileIds.Ids }),
            ct);

        foreach (var profileId in profileIds.Ids)
        {
            await WriteAuditAsync(
                HubAccessAuditAction.UserProfileAdded,
                user.Id,
                profileId,
                null,
                actorId,
                null,
                null,
                ct);
        }

        await _db.SaveChangesAsync(ct);
        return (true, null);
    }

    public async Task<(bool Success, string? Error)> UpdateUserAsync(HubUserInput input, CancellationToken ct)
    {
        var user = await _db.Users
            .Include(u => u.UserProfiles)
            .FirstOrDefaultAsync(u => u.Id == input.Id, ct);

        if (user is null)
            return (false, "Usuário não encontrado.");

        var email = NormalizeEmail(input.Email);
        if (string.IsNullOrWhiteSpace(email))
            return (false, "Informe um e-mail válido.");

        if (string.IsNullOrWhiteSpace(input.Name?.Trim()))
            return (false, "Informe o nome do usuário.");

        if (await _db.Users.AnyAsync(u => u.Id != input.Id && u.Email == email, ct))
            return (false, "Já existe outro usuário com este e-mail.");

        var profileIds = await ValidateProfileIdsAsync(input.SelectedProfileIds, ct);
        if (profileIds.Error is not null)
            return (false, profileIds.Error);

        var now = DateTimeOffset.UtcNow;
        var actorId = GetCurrentActorUserId();
        var previous = SerializeAudit(new
        {
            user.Email,
            user.Name,
            user.IsActive,
            Profiles = user.UserProfiles.Select(up => up.ProfileId).OrderBy(x => x).ToList()
        });

        user.Name = input.Name.Trim();
        user.Email = email;
        user.IsActive = input.IsActive;
        user.UpdatedAtUtc = now;

        var existingProfileIds = user.UserProfiles.Select(up => up.ProfileId).ToHashSet();
        var desiredProfileIds = profileIds.Ids.ToHashSet();

        foreach (var removed in existingProfileIds.Except(desiredProfileIds))
        {
            var link = user.UserProfiles.First(up => up.ProfileId == removed);
            _db.UserProfiles.Remove(link);
            await WriteAuditAsync(
                HubAccessAuditAction.UserProfileRemoved,
                user.Id,
                removed,
                null,
                actorId,
                null,
                null,
                ct);
        }

        foreach (var added in desiredProfileIds.Except(existingProfileIds))
        {
            _db.UserProfiles.Add(new HubUserProfile
            {
                UserId = user.Id,
                ProfileId = added,
                CreatedAtUtc = now,
                CreatedByUserId = actorId
            });
            await WriteAuditAsync(
                HubAccessAuditAction.UserProfileAdded,
                user.Id,
                added,
                null,
                actorId,
                null,
                null,
                ct);
        }

        await WriteAuditAsync(
            HubAccessAuditAction.UserUpdated,
            user.Id,
            null,
            null,
            actorId,
            previous,
            SerializeAudit(new
            {
                user.Email,
                user.Name,
                user.IsActive,
                Profiles = desiredProfileIds.OrderBy(x => x).ToList()
            }),
            ct);

        await _db.SaveChangesAsync(ct);
        return (true, null);
    }

    public async Task<IReadOnlyList<HubProfileListItem>> ListProfilesAsync(CancellationToken ct)
    {
        var rows = await _db.Profiles.AsNoTracking()
            .OrderBy(p => p.Name)
            .Select(p => new HubProfileListItem
            {
                Id = p.Id,
                Name = p.Name,
                Code = p.Code,
                IsActive = p.IsActive,
                UserCount = p.UserProfiles.Count,
                SystemAccessCount = p.ProfileSystemAccesses.Count
            })
            .ToListAsync(ct);

        foreach (var row in rows)
            row.IsBuiltIn = HubBuiltInCatalog.IsBuiltInProfile(row.Code);

        return rows;
    }

    public async Task<HubProfileInput?> GetProfileAsync(Guid id, CancellationToken ct)
    {
        var profile = await _db.Profiles.AsNoTracking()
            .Include(p => p.ProfileSystemAccesses)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (profile is null) return null;

        return new HubProfileInput
        {
            Id = profile.Id,
            Name = profile.Name,
            Code = profile.Code,
            Description = profile.Description,
            IsActive = profile.IsActive,
            SelectedSystemIds = profile.ProfileSystemAccesses.Select(psa => psa.SystemId).ToList()
        };
    }

    public async Task<(bool Success, string? Error)> CreateProfileAsync(HubProfileInput input, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Name?.Trim()))
            return (false, "Informe o nome do perfil.");

        var code = string.IsNullOrWhiteSpace(input.Code)
            ? HubSlugHelper.FromName(input.Name)
            : HubSlugHelper.NormalizeCode(input.Code);

        if (string.IsNullOrWhiteSpace(code))
            return (false, "Informe um código válido para o perfil.");

        if (await _db.Profiles.AnyAsync(p => p.Code == code, ct))
            return (false, "Já existe um perfil com este código.");

        var systemIds = await ValidateSystemIdsAsync(input.SelectedSystemIds, ct);
        if (systemIds.Error is not null)
            return (false, systemIds.Error);

        var now = DateTimeOffset.UtcNow;
        var actorId = GetCurrentActorUserId();

        var profile = new HubProfile
        {
            Id = Guid.NewGuid(),
            Name = input.Name.Trim(),
            Code = code,
            Description = input.Description?.Trim(),
            IsActive = input.IsActive,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        _db.Profiles.Add(profile);

        foreach (var systemId in systemIds.Ids)
        {
            _db.ProfileSystemAccesses.Add(new HubProfileSystemAccess
            {
                ProfileId = profile.Id,
                SystemId = systemId,
                CreatedAtUtc = now,
                CreatedByUserId = actorId
            });
        }

        await WriteAuditAsync(
            HubAccessAuditAction.ProfileCreated,
            null,
            profile.Id,
            null,
            actorId,
            null,
            SerializeAudit(new { profile.Code, profile.Name, Systems = systemIds.Ids }),
            ct);

        foreach (var systemId in systemIds.Ids)
        {
            await WriteAuditAsync(
                HubAccessAuditAction.ProfileSystemAccessAdded,
                null,
                profile.Id,
                systemId,
                actorId,
                null,
                null,
                ct);
        }

        await _db.SaveChangesAsync(ct);
        return (true, null);
    }

    public async Task<(bool Success, string? Error)> UpdateProfileAsync(HubProfileInput input, CancellationToken ct)
    {
        var profile = await _db.Profiles
            .Include(p => p.ProfileSystemAccesses)
            .FirstOrDefaultAsync(p => p.Id == input.Id, ct);

        if (profile is null)
            return (false, "Perfil não encontrado.");

        if (string.IsNullOrWhiteSpace(input.Name?.Trim()))
            return (false, "Informe o nome do perfil.");

        var isBuiltIn = HubBuiltInCatalog.IsBuiltInProfile(profile.Code);
        var code = isBuiltIn
            ? profile.Code
            : string.IsNullOrWhiteSpace(input.Code)
                ? HubSlugHelper.FromName(input.Name)
                : HubSlugHelper.NormalizeCode(input.Code);

        if (string.IsNullOrWhiteSpace(code))
            return (false, "Informe um código válido para o perfil.");

        if (!isBuiltIn && await _db.Profiles.AnyAsync(p => p.Id != input.Id && p.Code == code, ct))
            return (false, "Já existe outro perfil com este código.");

        var systemIds = await ValidateSystemIdsAsync(input.SelectedSystemIds, ct);
        if (systemIds.Error is not null)
            return (false, systemIds.Error);

        var now = DateTimeOffset.UtcNow;
        var actorId = GetCurrentActorUserId();
        var previous = SerializeAudit(new
        {
            profile.Code,
            profile.Name,
            profile.IsActive,
            Systems = profile.ProfileSystemAccesses.Select(psa => psa.SystemId).OrderBy(x => x).ToList()
        });

        profile.Name = input.Name.Trim();
        if (!isBuiltIn)
            profile.Code = code;
        profile.Description = input.Description?.Trim();
        profile.IsActive = input.IsActive;
        profile.UpdatedAtUtc = now;

        var existingSystemIds = profile.ProfileSystemAccesses.Select(psa => psa.SystemId).ToHashSet();
        var desiredSystemIds = systemIds.Ids.ToHashSet();

        foreach (var removed in existingSystemIds.Except(desiredSystemIds))
        {
            var link = profile.ProfileSystemAccesses.First(psa => psa.SystemId == removed);
            _db.ProfileSystemAccesses.Remove(link);
            await WriteAuditAsync(
                HubAccessAuditAction.ProfileSystemAccessRemoved,
                null,
                profile.Id,
                removed,
                actorId,
                null,
                null,
                ct);
        }

        foreach (var added in desiredSystemIds.Except(existingSystemIds))
        {
            _db.ProfileSystemAccesses.Add(new HubProfileSystemAccess
            {
                ProfileId = profile.Id,
                SystemId = added,
                CreatedAtUtc = now,
                CreatedByUserId = actorId
            });
            await WriteAuditAsync(
                HubAccessAuditAction.ProfileSystemAccessAdded,
                null,
                profile.Id,
                added,
                actorId,
                null,
                null,
                ct);
        }

        await WriteAuditAsync(
            HubAccessAuditAction.ProfileUpdated,
            null,
            profile.Id,
            null,
            actorId,
            previous,
            SerializeAudit(new
            {
                profile.Code,
                profile.Name,
                profile.IsActive,
                Systems = desiredSystemIds.OrderBy(x => x).ToList()
            }),
            ct);

        await _db.SaveChangesAsync(ct);
        return (true, null);
    }

    public async Task<(bool Success, string? Error)> DeleteProfileAsync(Guid id, CancellationToken ct)
    {
        var profile = await _db.Profiles
            .Include(p => p.UserProfiles)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (profile is null)
            return (false, "Perfil não encontrado.");

        if (HubBuiltInCatalog.IsBuiltInProfile(profile.Code))
            return (false, "Perfis padrão do sistema não podem ser excluídos.");

        if (profile.UserProfiles.Count > 0)
            return (false, "Remova os usuários deste perfil antes de excluí-lo.");

        var actorId = GetCurrentActorUserId();

        await WriteAuditAsync(
            HubAccessAuditAction.ProfileDeleted,
            null,
            profile.Id,
            null,
            actorId,
            SerializeAudit(new { profile.Code, profile.Name }),
            null,
            ct);

        _db.Profiles.Remove(profile);
        await _db.SaveChangesAsync(ct);
        return (true, null);
    }

    public async Task<IReadOnlyList<HubSystemListItem>> ListSystemsAsync(CancellationToken ct)
    {
        var rows = await _db.Systems.AsNoTracking()
            .OrderBy(s => s.Name)
            .Select(s => new HubSystemListItem
            {
                Id = s.Id,
                Name = s.Name,
                Code = s.Code,
                IsActive = s.IsActive,
                ApplicationCount = s.Applications.Count,
                ProfileAccessCount = s.ProfileSystemAccesses.Count
            })
            .ToListAsync(ct);

        foreach (var row in rows)
            row.IsBuiltIn = HubBuiltInCatalog.IsBuiltInSystem(row.Code);

        return rows;
    }

    public async Task<HubSystemInput?> GetSystemAsync(Guid id, CancellationToken ct)
    {
        var system = await _db.Systems.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id, ct);
        if (system is null) return null;

        return new HubSystemInput
        {
            Id = system.Id,
            Name = system.Name,
            Code = system.Code,
            Description = system.Description,
            Url = system.Url,
            IconKey = system.IconKey,
            IsActive = system.IsActive,
            RequiresApproval = system.RequiresApproval
        };
    }

    public async Task<(bool Success, string? Error)> CreateSystemAsync(HubSystemInput input, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Name?.Trim()))
            return (false, "Informe o nome do sistema.");

        var code = string.IsNullOrWhiteSpace(input.Code)
            ? HubSlugHelper.FromName(input.Name)
            : HubSlugHelper.NormalizeCode(input.Code);

        if (string.IsNullOrWhiteSpace(code))
            return (false, "Informe um código válido para o sistema.");

        if (await _db.Systems.AnyAsync(s => s.Code == code, ct))
            return (false, "Já existe um sistema com este código.");

        var now = DateTimeOffset.UtcNow;
        var actorId = GetCurrentActorUserId();

        var system = new HubSystem
        {
            Id = Guid.NewGuid(),
            Name = input.Name.Trim(),
            Code = code,
            Description = input.Description?.Trim(),
            Url = input.Url?.Trim(),
            IconKey = input.IconKey?.Trim(),
            IsActive = input.IsActive,
            RequiresApproval = input.RequiresApproval,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        _db.Systems.Add(system);

        await WriteAuditAsync(
            HubAccessAuditAction.SystemCreated,
            null,
            null,
            system.Id,
            actorId,
            null,
            SerializeAudit(new { system.Code, system.Name }),
            ct);

        await _db.SaveChangesAsync(ct);
        return (true, null);
    }

    public async Task<(bool Success, string? Error)> UpdateSystemAsync(HubSystemInput input, CancellationToken ct)
    {
        var system = await _db.Systems.FirstOrDefaultAsync(s => s.Id == input.Id, ct);
        if (system is null)
            return (false, "Sistema não encontrado.");

        if (string.IsNullOrWhiteSpace(input.Name?.Trim()))
            return (false, "Informe o nome do sistema.");

        var isBuiltIn = HubBuiltInCatalog.IsBuiltInSystem(system.Code);
        var code = isBuiltIn
            ? system.Code
            : string.IsNullOrWhiteSpace(input.Code)
                ? HubSlugHelper.FromName(input.Name)
                : HubSlugHelper.NormalizeCode(input.Code);

        if (string.IsNullOrWhiteSpace(code))
            return (false, "Informe um código válido para o sistema.");

        if (!isBuiltIn && await _db.Systems.AnyAsync(s => s.Id != input.Id && s.Code == code, ct))
            return (false, "Já existe outro sistema com este código.");

        var actorId = GetCurrentActorUserId();
        var previous = SerializeAudit(new { system.Code, system.Name, system.IsActive });

        system.Name = input.Name.Trim();
        if (!isBuiltIn)
            system.Code = code;
        system.Description = input.Description?.Trim();
        system.Url = input.Url?.Trim();
        system.IconKey = input.IconKey?.Trim();
        system.IsActive = input.IsActive;
        system.RequiresApproval = input.RequiresApproval;
        system.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await WriteAuditAsync(
            HubAccessAuditAction.SystemUpdated,
            null,
            null,
            system.Id,
            actorId,
            previous,
            SerializeAudit(new { system.Code, system.Name, system.IsActive }),
            ct);

        await _db.SaveChangesAsync(ct);
        return (true, null);
    }

    public async Task<(bool Success, string? Error)> DeleteSystemAsync(Guid id, CancellationToken ct)
    {
        var system = await _db.Systems
            .Include(s => s.Applications)
            .Include(s => s.ProfileSystemAccesses)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        if (system is null)
            return (false, "Sistema não encontrado.");

        if (HubBuiltInCatalog.IsBuiltInSystem(system.Code))
            return (false, "Sistemas padrão do catálogo não podem ser excluídos.");

        if (system.Applications.Count > 0)
            return (false, "Desvincule ou exclua os aplicativos ligados a este sistema antes de excluí-lo.");

        var actorId = GetCurrentActorUserId();

        await WriteAuditAsync(
            HubAccessAuditAction.SystemDeleted,
            null,
            null,
            system.Id,
            actorId,
            SerializeAudit(new { system.Code, system.Name }),
            null,
            ct);

        _db.ProfileSystemAccesses.RemoveRange(system.ProfileSystemAccesses);
        _db.Systems.Remove(system);
        await _db.SaveChangesAsync(ct);
        return (true, null);
    }

    public async Task<IReadOnlyList<HubAuditListItem>> ListAuditsAsync(int take, CancellationToken ct)
    {
        take = Math.Clamp(take, 1, 500);

        var audits = await _db.AccessAudits.AsNoTracking()
            .OrderByDescending(a => a.OccurredAtUtc)
            .Take(take)
            .ToListAsync(ct);

        if (audits.Count == 0)
            return [];

        var userIds = audits
            .SelectMany(a => new[] { a.AffectedUserId, a.ChangedByUserId })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var profileIds = audits
            .Where(a => a.ProfileId.HasValue)
            .Select(a => a.ProfileId!.Value)
            .Distinct()
            .ToList();

        var systemIds = audits
            .Where(a => a.SystemId.HasValue)
            .Select(a => a.SystemId!.Value)
            .Distinct()
            .ToList();

        var users = await _db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Email, ct);

        var profiles = profileIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.Profiles.AsNoTracking()
                .Where(p => profileIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.Code, ct);

        var systems = systemIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.Systems.AsNoTracking()
                .Where(s => systemIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id, s => s.Code, ct);

        return audits.Select(a => new HubAuditListItem
        {
            Id = a.Id,
            Action = a.Action,
            ActionLabel = FormatAuditAction(a.Action),
            OccurredAtUtc = a.OccurredAtUtc,
            AffectedUserEmail = a.AffectedUserId is Guid uid && users.TryGetValue(uid, out var email) ? email : null,
            ProfileCode = a.ProfileId is Guid pid && profiles.TryGetValue(pid, out var pcode) ? pcode : null,
            SystemCode = a.SystemId is Guid sid && systems.TryGetValue(sid, out var scode) ? scode : null,
            ChangedByEmail = a.ChangedByUserId is Guid cid && users.TryGetValue(cid, out var cemail) ? cemail : null,
            PreviousData = a.PreviousData,
            NewData = a.NewData
        }).ToList();
    }

    public async Task<IReadOnlyList<HubSelectOption>> GetProfileOptionsAsync(CancellationToken ct) =>
        await _db.Profiles.AsNoTracking()
            .OrderBy(p => p.Name)
            .Select(p => new HubSelectOption
            {
                Id = p.Id,
                Label = p.Name,
                Code = p.Code,
                IsActive = p.IsActive
            })
            .ToListAsync(ct);

    public async Task<IReadOnlyList<HubSelectOption>> GetSystemOptionsAsync(CancellationToken ct) =>
        await _db.Systems.AsNoTracking()
            .OrderBy(s => s.Name)
            .Select(s => new HubSelectOption
            {
                Id = s.Id,
                Label = s.Name,
                Code = s.Code,
                IsActive = s.IsActive
            })
            .ToListAsync(ct);

    private async Task<(List<Guid> Ids, string? Error)> ValidateProfileIdsAsync(
        IEnumerable<Guid> profileIds,
        CancellationToken ct)
    {
        var ids = profileIds.Distinct().ToList();
        if (ids.Count == 0)
            return (ids, null);

        var found = await _db.Profiles.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => p.Id)
            .ToListAsync(ct);

        if (found.Count != ids.Count)
            return ([], "Um ou mais perfis selecionados são inválidos.");

        return (ids, null);
    }

    private async Task<(List<Guid> Ids, string? Error)> ValidateSystemIdsAsync(
        IEnumerable<Guid> systemIds,
        CancellationToken ct)
    {
        var ids = systemIds.Distinct().ToList();
        if (ids.Count == 0)
            return (ids, null);

        var found = await _db.Systems.AsNoTracking()
            .Where(s => ids.Contains(s.Id) && s.IsActive)
            .Select(s => s.Id)
            .ToListAsync(ct);

        if (found.Count != ids.Count)
            return ([], "Um ou mais sistemas selecionados são inválidos ou estão inativos.");

        return (ids, null);
    }

    private Guid? GetCurrentActorUserId()
    {
        var raw = _httpContextAccessor.HttpContext?.User.FindFirst(HubClaimTypes.UserId)?.Value;
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    private async Task WriteAuditAsync(
        string action,
        Guid? affectedUserId,
        Guid? profileId,
        Guid? systemId,
        Guid? changedByUserId,
        string? previousData,
        string? newData,
        CancellationToken ct)
    {
        _db.AccessAudits.Add(new HubAccessAudit
        {
            Id = Guid.NewGuid(),
            Action = action,
            AffectedUserId = affectedUserId,
            ProfileId = profileId,
            SystemId = systemId,
            ChangedByUserId = changedByUserId,
            PreviousData = previousData,
            NewData = newData,
            OccurredAtUtc = DateTimeOffset.UtcNow
        });

        await Task.CompletedTask;
    }

    private static string SerializeAudit(object value) =>
        JsonSerializer.Serialize(value, AuditJsonOptions);

    private static string NormalizeEmail(string email) =>
        string.IsNullOrWhiteSpace(email) ? string.Empty : email.Trim().ToLowerInvariant();

    internal static string FormatAuditAction(string action) => action switch
    {
        HubAccessAuditAction.UserCreated => "Usuário criado",
        HubAccessAuditAction.UserUpdated => "Usuário atualizado",
        HubAccessAuditAction.UserProfileAdded => "Perfil atribuído ao usuário",
        HubAccessAuditAction.UserProfileRemoved => "Perfil removido do usuário",
        HubAccessAuditAction.ProfileCreated => "Perfil criado",
        HubAccessAuditAction.ProfileUpdated => "Perfil atualizado",
        HubAccessAuditAction.ProfileDeleted => "Perfil excluído",
        HubAccessAuditAction.ProfileSystemAccessAdded => "Sistema liberado no perfil",
        HubAccessAuditAction.ProfileSystemAccessRemoved => "Sistema removido do perfil",
        HubAccessAuditAction.SystemCreated => "Sistema criado",
        HubAccessAuditAction.SystemUpdated => "Sistema atualizado",
        HubAccessAuditAction.SystemDeleted => "Sistema excluído",
        _ => action
    };
}

public static class HubSlugHelper
{
    private static readonly Regex InvalidChars = new(@"[^a-z0-9\-]+", RegexOptions.Compiled);

    public static string FromName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return string.Empty;

        var normalized = name.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);

        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
                continue;

            builder.Append(ch switch
            {
                ' ' or '_' => '-',
                >= 'a' and <= 'z' or >= '0' and <= '9' or '-' => ch,
                _ => '-'
            });
        }

        return NormalizeCode(builder.ToString());
    }

    public static string NormalizeCode(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
            return string.Empty;

        var normalized = code.Trim().ToLowerInvariant();
        normalized = InvalidChars.Replace(normalized, "-");
        while (normalized.Contains("--", StringComparison.Ordinal))
            normalized = normalized.Replace("--", "-", StringComparison.Ordinal);

        return normalized.Trim('-');
    }
}
