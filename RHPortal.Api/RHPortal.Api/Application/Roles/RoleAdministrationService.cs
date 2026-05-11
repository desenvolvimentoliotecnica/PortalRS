using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Roles;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Security;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.Roles;

public sealed class RoleAdministrationService
{
    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly AppDbContext _db;
    private readonly IStringLocalizer<ServiceMessages> _localizer;

    public RoleAdministrationService(RoleManager<ApplicationRole> roleManager, AppDbContext db, IStringLocalizer<ServiceMessages> localizer)
    {
        _roleManager = roleManager;
        _db = db;
        _localizer = localizer;
    }

    public async Task<IReadOnlyList<RoleListItemResponse>> ListAsync(CancellationToken ct)
    {
        return await _roleManager.Roles
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new RoleListItemResponse(
                x.Id,
                x.Name ?? string.Empty,
                x.Description ?? string.Empty,
                x.IsActive,
                x.VisibilityScope,
                x.VagasDataScope,
                x.AccessMode,
                x.Tipo))
            .ToListAsync(ct);
    }

    public async Task<RoleResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        return await _roleManager.Roles
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new RoleResponse(
                x.Id,
                x.Name ?? string.Empty,
                x.Description ?? string.Empty,
                x.IsActive,
                x.VisibilityScope,
                x.VagasDataScope,
                x.AccessMode,
                x.Tipo,
                x.CreatedAtUtc,
                x.UpdatedAtUtc))
            .FirstOrDefaultAsync(ct);
    }

    public async Task<RoleResponse> CreateAsync(RoleCreateRequest request, CancellationToken ct)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException(_localizer["ServiceErrors.RoleNameRequired"]);

        var exists = await _roleManager.Roles.AnyAsync(x => x.Name == name, ct);
        if (exists)
            throw new InvalidOperationException(_localizer["ServiceErrors.RoleNameExists"]);

        var role = new ApplicationRole
        {
            Id = Guid.NewGuid(),
            Name = name,
            Description = request.Description?.Trim() ?? string.Empty,
            IsActive = request.IsActive,
            VisibilityScope = request.VisibilityScope,
            VagasDataScope = request.VagasDataScope,
            AccessMode = request.AccessMode,
            Tipo = request.Tipo
        };

        var result = await _roleManager.CreateAsync(role);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join("; ", result.Errors.Select(x => x.Description)));

        var created = await GetByIdAsync(role.Id, ct);
        return created!;
    }

    public async Task<RoleResponse?> UpdateAsync(Guid id, RoleUpdateRequest request, CancellationToken ct)
    {
        var role = await _roleManager.Roles.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (role is null) return null;

        var name = request.Name.Trim();
        if (!string.Equals(role.Name, name, StringComparison.OrdinalIgnoreCase))
        {
            var exists = await _roleManager.Roles.AnyAsync(x => x.Name == name && x.Id != id, ct);
            if (exists)
                throw new InvalidOperationException(_localizer["ServiceErrors.RoleNameExists"]);

            role.Name = name;
        }

        role.Description = request.Description?.Trim() ?? string.Empty;
        role.IsActive = request.IsActive;
        role.VisibilityScope = request.VisibilityScope;
        role.VagasDataScope = request.VagasDataScope;
        role.AccessMode = request.AccessMode;
        role.Tipo = request.Tipo;

        var result = await _roleManager.UpdateAsync(role);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join("; ", result.Errors.Select(x => x.Description)));

        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var role = await _roleManager.Roles.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (role is null) return false;

        var result = await _roleManager.DeleteAsync(role);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join("; ", result.Errors.Select(x => x.Description)));

        return true;
    }

    /// <summary>
    /// Resolve permissões efetivas para um perfil. Se o perfil tiver configuração manual,
    /// usa <see cref="RoleMenu"/>; caso contrário, usa o manifesto code-first.
    /// </summary>
    public async Task<RoleEffectivePermissionsResponse?> GetEffectivePermissionsAsync(Guid id, CancellationToken ct)
    {
        var role = await _roleManager.Roles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (role is null) return null;

        var keys = await ResolvePermissionsAsync(new[] { role }, ct);
        var wildcard = keys.Count == 1 && string.Equals(keys[0], "*", StringComparison.Ordinal);
        return new RoleEffectivePermissionsResponse(keys, wildcard, role.UseCustomPermissions);
    }

    public async Task<IReadOnlyList<string>> ResolvePermissionsAsync(IEnumerable<ApplicationRole> roles, CancellationToken ct)
    {
        var roleList = roles.ToList();
        if (roleList.Count == 0) return [];

        var permissions = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var manifestoRoles = roleList.Where(r => !r.UseCustomPermissions).ToList();
        foreach (var key in RolePermissionManifest.GetPermissions(manifestoRoles))
        {
            if (string.Equals(key, "*", StringComparison.Ordinal))
                return ["*"];
            permissions.Add(key);
        }

        var customRoleIds = roleList
            .Where(r => r.UseCustomPermissions)
            .Select(r => r.Id)
            .Distinct()
            .ToList();

        if (customRoleIds.Count > 0)
        {
            var customKeys = await _db.RoleMenus
                .AsNoTracking()
                .Where(x => customRoleIds.Contains(x.RoleId))
                .Select(x => x.PermissionKey)
                .Distinct()
                .ToListAsync(ct);

            foreach (var key in customKeys)
                permissions.Add(key);
        }

        return permissions
            .OrderBy(x => x, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public async Task<RoleEffectivePermissionsResponse?> UpdateRoleMenusAsync(Guid id, RoleMenusUpdateRequest request, CancellationToken ct)
    {
        var role = await _roleManager.Roles.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (role is null) return null;

        var items = (request.Items ?? Array.Empty<RoleMenuAssignmentRequest>())
            .GroupBy(x => x.MenuId)
            .Select(g => g.First())
            .ToList();

        var menuIds = items.Select(x => x.MenuId).Distinct().ToList();
        var menusById = menuIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.Menus
                .AsNoTracking()
                .Where(x => menuIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.PermissionKey, ct);

        if (menusById.Count != menuIds.Count)
            throw new InvalidOperationException("Um ou mais menus informados não existem.");

        foreach (var item in items)
        {
            if (!menusById.TryGetValue(item.MenuId, out var expectedPermission))
                throw new InvalidOperationException("Menu inválido.");

            if (!string.Equals(expectedPermission, item.PermissionKey, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("A permissão informada não corresponde ao menu selecionado.");
        }

        var currentAssignments = await _db.RoleMenus
            .Where(x => x.RoleId == id)
            .ToListAsync(ct);

        _db.RoleMenus.RemoveRange(currentAssignments);

        var now = DateTimeOffset.UtcNow;
        if (items.Count > 0)
        {
            _db.RoleMenus.AddRange(items.Select(item => new RoleMenu
            {
                Id = Guid.NewGuid(),
                TenantId = role.TenantId,
                RoleId = role.Id,
                MenuId = item.MenuId,
                PermissionKey = item.PermissionKey.Trim(),
                CreatedAtUtc = now,
            }));
        }

        role.UseCustomPermissions = true;
        role.UpdatedAtUtc = now;
        await _db.SaveChangesAsync(ct);

        return await GetEffectivePermissionsAsync(id, ct);
    }

    public async Task<bool> ResetRoleMenusToManifestAsync(Guid id, CancellationToken ct)
    {
        var role = await _roleManager.Roles.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (role is null) return false;

        var currentAssignments = await _db.RoleMenus
            .Where(x => x.RoleId == id)
            .ToListAsync(ct);

        _db.RoleMenus.RemoveRange(currentAssignments);
        role.UseCustomPermissions = false;
        role.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
