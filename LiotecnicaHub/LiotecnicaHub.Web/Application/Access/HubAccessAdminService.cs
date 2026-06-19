using System.Text.Json;
using LiotecnicaHub.Web.Application.Authentication;
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
    private readonly IHubPasswordService _passwords;

    public HubAccessAdminService(
        HubDbContext db,
        IHttpContextAccessor httpContextAccessor,
        IHubPasswordService passwords)
    {
        _db = db;
        _httpContextAccessor = httpContextAccessor;
        _passwords = passwords;
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
                ApplicationCount = u.UserApplicationAccesses.Count(ua => ua.Application.IsActive),
                ApplicationNames = u.UserApplicationAccesses
                    .Where(ua => ua.Application.IsActive)
                    .Select(ua => ua.Application.Name)
                    .OrderBy(n => n)
                    .ToList(),
                UpdatedAtUtc = u.UpdatedAtUtc
            })
            .ToListAsync(ct);
    }

    public async Task<HubUserInput?> GetUserAsync(Guid id, CancellationToken ct)
    {
        var user = await _db.Users.AsNoTracking()
            .Include(u => u.UserApplicationAccesses)
            .FirstOrDefaultAsync(u => u.Id == id, ct);

        if (user is null) return null;

        return new HubUserInput
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            IsActive = user.IsActive,
            HasLocalPassword = !string.IsNullOrWhiteSpace(user.PasswordHash),
            PreferDirectoryAuth = user.PreferDirectoryAuth,
            SelectedApplicationIds = user.UserApplicationAccesses.Select(ua => ua.ApplicationId).ToList()
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

        var applicationIds = await ValidateApplicationIdsAsync(input.SelectedApplicationIds, ct);
        if (applicationIds.Error is not null)
            return (false, applicationIds.Error);

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
        user.PasswordHash = _passwords.HashPassword(user, _passwords.GetDefaultPassword());

        _db.Users.Add(user);

        foreach (var applicationId in applicationIds.Ids)
        {
            _db.UserApplicationAccesses.Add(new HubUserApplicationAccess
            {
                UserId = user.Id,
                ApplicationId = applicationId,
                CreatedAtUtc = now,
                CreatedByUserId = actorId
            });
        }

        await WriteAuditAsync(
            HubAccessAuditAction.UserCreated,
            user.Id,
            null,
            actorId,
            null,
            SerializeAudit(new { user.Email, user.Name, Applications = applicationIds.Ids }),
            ct);

        foreach (var applicationId in applicationIds.Ids)
        {
            await WriteAuditAsync(
                HubAccessAuditAction.UserApplicationAdded,
                user.Id,
                applicationId,
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
            .Include(u => u.UserApplicationAccesses)
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

        var applicationIds = await ValidateApplicationIdsAsync(input.SelectedApplicationIds, ct);
        if (applicationIds.Error is not null)
            return (false, applicationIds.Error);

        var now = DateTimeOffset.UtcNow;
        var actorId = GetCurrentActorUserId();
        var previous = SerializeAudit(new
        {
            user.Email,
            user.Name,
            user.IsActive,
            Applications = user.UserApplicationAccesses.Select(ua => ua.ApplicationId).OrderBy(x => x).ToList()
        });

        user.Name = input.Name.Trim();
        user.Email = email;
        user.IsActive = input.IsActive;
        user.UpdatedAtUtc = now;

        if (await ApplyPasswordChangeAsync(user, input, actorId, ct) is { } passwordError)
            return (false, passwordError);

        var existingApplicationIds = user.UserApplicationAccesses.Select(ua => ua.ApplicationId).ToHashSet();
        var desiredApplicationIds = applicationIds.Ids.ToHashSet();

        foreach (var removed in existingApplicationIds.Except(desiredApplicationIds))
        {
            var link = user.UserApplicationAccesses.First(ua => ua.ApplicationId == removed);
            _db.UserApplicationAccesses.Remove(link);
            await WriteAuditAsync(
                HubAccessAuditAction.UserApplicationRemoved,
                user.Id,
                removed,
                actorId,
                null,
                null,
                ct);
        }

        foreach (var added in desiredApplicationIds.Except(existingApplicationIds))
        {
            _db.UserApplicationAccesses.Add(new HubUserApplicationAccess
            {
                UserId = user.Id,
                ApplicationId = added,
                CreatedAtUtc = now,
                CreatedByUserId = actorId
            });
            await WriteAuditAsync(
                HubAccessAuditAction.UserApplicationAdded,
                user.Id,
                added,
                actorId,
                null,
                null,
                ct);
        }

        await WriteAuditAsync(
            HubAccessAuditAction.UserUpdated,
            user.Id,
            null,
            actorId,
            previous,
            SerializeAudit(new
            {
                user.Email,
                user.Name,
                user.IsActive,
                Applications = desiredApplicationIds.OrderBy(x => x).ToList()
            }),
            ct);

        await _db.SaveChangesAsync(ct);
        return (true, null);
    }

    public async Task<HubUserDeleteInfo?> GetUserDeleteInfoAsync(Guid id, CancellationToken ct)
    {
        var user = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == id, ct);

        if (user is null)
            return null;

        var isAdmin = await _db.Admins.AsNoTracking()
            .AnyAsync(a => a.Email == user.Email, ct);

        return new HubUserDeleteInfo
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            IsHubAdmin = isAdmin
        };
    }

    public async Task<(bool Success, string? Error)> DeleteUserAsync(Guid id, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null)
            return (false, "Usuário não encontrado.");

        var actorId = GetCurrentActorUserId();
        if (actorId == user.Id)
        {
            return (false,
                "Você não pode excluir o próprio usuário enquanto estiver autenticado. Peça a outro administrador ou use outra conta.");
        }

        var adminEntry = await _db.Admins.FirstOrDefaultAsync(a => a.Email == user.Email, ct);
        if (adminEntry is not null)
        {
            var adminCount = await _db.Admins.CountAsync(ct);
            if (adminCount <= 1)
            {
                return (false,
                    "Não é possível excluir o último administrador do Hub. Cadastre outro admin antes.");
            }
        }

        var snapshot = SerializeAudit(new
        {
            user.Email,
            user.Name,
            user.IsActive,
            WasHubAdmin = adminEntry is not null
        });

        await WriteAuditAsync(
            HubAccessAuditAction.UserDeleted,
            user.Id,
            null,
            actorId,
            snapshot,
            null,
            ct);

        if (adminEntry is not null)
            _db.Admins.Remove(adminEntry);

        _db.Users.Remove(user);
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

        var users = await _db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Email, ct);

        var applicationIdsFromJson = audits
            .Where(a => a.ApplicationId.HasValue)
            .Select(a => a.ApplicationId!.Value)
            .ToHashSet();

        var applications = applicationIdsFromJson.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.Applications.AsNoTracking()
                .Where(a => applicationIdsFromJson.Contains(a.Id))
                .ToDictionaryAsync(a => a.Id, a => a.Name, ct);

        return audits.Select(a => new HubAuditListItem
        {
            Id = a.Id,
            Action = a.Action,
            ActionLabel = FormatAuditAction(a.Action),
            OccurredAtUtc = a.OccurredAtUtc,
            AffectedUserEmail = a.AffectedUserId is Guid uid && users.TryGetValue(uid, out var email) ? email : null,
            ApplicationName = ResolveApplicationName(a, applications),
            ChangedByEmail = a.ChangedByUserId is Guid cid && users.TryGetValue(cid, out var cemail) ? cemail : null,
            PreviousData = a.PreviousData,
            NewData = a.NewData
        }).ToList();
    }

    public async Task<IReadOnlyList<HubSelectOption>> GetApplicationOptionsAsync(CancellationToken ct) =>
        await _db.Applications.AsNoTracking()
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.Name)
            .Select(a => new HubSelectOption
            {
                Id = a.Id,
                Label = a.Name,
                Code = a.Environment.ToString(),
                IsActive = a.IsActive
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

    private async Task<(List<Guid> Ids, string? Error)> ValidateApplicationIdsAsync(
        IEnumerable<Guid> applicationIds,
        CancellationToken ct)
    {
        var ids = applicationIds.Distinct().ToList();
        if (ids.Count == 0)
            return (ids, null);

        var found = await _db.Applications.AsNoTracking()
            .Where(a => ids.Contains(a.Id) && a.IsActive)
            .Select(a => a.Id)
            .ToListAsync(ct);

        if (found.Count != ids.Count)
            return ([], "Um ou mais aplicativos selecionados são inválidos ou estão inativos.");

        return (ids, null);
    }

    private async Task<string?> ApplyPasswordChangeAsync(
        HubUser user,
        HubUserInput input,
        Guid? actorId,
        CancellationToken ct)
    {
        if (input.ClearLocalPassword)
        {
            if (input.ResetPasswordToDefault || !string.IsNullOrWhiteSpace(input.NewPassword))
                return "Remova a senha local ou defina uma nova senha — não os dois na mesma operação.";

            if (string.IsNullOrWhiteSpace(user.PasswordHash))
                return null;

            user.PasswordHash = null;
            user.PreferDirectoryAuth = true;

            await WriteAuditAsync(
                HubAccessAuditAction.UserPasswordChanged,
                user.Id,
                null,
                actorId,
                "senha_local",
                "removida_para_ldap",
                ct);

            return null;
        }

        string? newPassword = null;

        if (input.ResetPasswordToDefault)
            newPassword = _passwords.GetDefaultPassword();
        else if (!string.IsNullOrWhiteSpace(input.NewPassword))
            newPassword = input.NewPassword.Trim();

        if (newPassword is null)
            return null;

        if (newPassword.Length < 8)
            return "A senha deve ter pelo menos 8 caracteres.";

        user.PasswordHash = _passwords.HashPassword(user, newPassword);
        user.PreferDirectoryAuth = false;

        await WriteAuditAsync(
            HubAccessAuditAction.UserPasswordChanged,
            user.Id,
            null,
            actorId,
            null,
            input.ResetPasswordToDefault ? "reset_padrao" : "alterada_admin",
            ct);

        return null;
    }

    private Guid? GetCurrentActorUserId()
    {
        var raw = _httpContextAccessor.HttpContext?.User.FindFirst(HubClaimTypes.UserId)?.Value;
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    private Task WriteAuditAsync(
        string action,
        Guid? affectedUserId,
        Guid? applicationId,
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
            ApplicationId = applicationId,
            ChangedByUserId = changedByUserId,
            PreviousData = previousData,
            NewData = newData,
            OccurredAtUtc = DateTimeOffset.UtcNow
        });

        return Task.CompletedTask;
    }

    private static string SerializeAudit(object value) =>
        JsonSerializer.Serialize(value, AuditJsonOptions);

    private static string NormalizeEmail(string email) =>
        string.IsNullOrWhiteSpace(email) ? string.Empty : email.Trim().ToLowerInvariant();

    private static string? ResolveApplicationName(HubAccessAudit audit, IReadOnlyDictionary<Guid, string> applications)
    {
        if (audit.ApplicationId is Guid appId && applications.TryGetValue(appId, out var name))
            return name;

        return null;
    }

    internal static string FormatAuditAction(string action) => action switch
    {
        HubAccessAuditAction.UserCreated => "Usuário criado",
        HubAccessAuditAction.UserUpdated => "Usuário atualizado",
        HubAccessAuditAction.UserApplicationAdded => "Aplicativo liberado",
        HubAccessAuditAction.UserApplicationRemoved => "Aplicativo removido",
        HubAccessAuditAction.UserPasswordChanged => "Senha alterada",
        HubAccessAuditAction.UserDeleted => "Usuário excluído",
        HubAccessAuditAction.UserProfileAdded => "Perfil atribuído (legado)",
        HubAccessAuditAction.UserProfileRemoved => "Perfil removido (legado)",
        _ => action
    };
}
