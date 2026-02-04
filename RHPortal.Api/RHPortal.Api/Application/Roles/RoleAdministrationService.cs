using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Roles;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
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
                x.AccessMode))
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
            AccessMode = request.AccessMode
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

    public async Task<bool> UpdateRoleMenusAsync(Guid roleId, RoleMenusUpdateRequest request, CancellationToken ct)
    {
        var role = await _roleManager.Roles.FirstOrDefaultAsync(x => x.Id == roleId, ct);
        if (role is null) return false;

        var menuIds = request.Items.Select(x => x.MenuId).Distinct().ToList();
        var menus = await _db.Menus.Where(x => menuIds.Contains(x.Id)).ToListAsync(ct);

        if (menus.Count != menuIds.Count)
            throw new InvalidOperationException(_localizer["ServiceErrors.RoleMenusNotFound"]);

        var existing = await _db.RoleMenus.Where(x => x.RoleId == roleId).ToListAsync(ct);
        if (existing.Count > 0)
            _db.RoleMenus.RemoveRange(existing);

        var items = request.Items.Select(item => new RoleMenu
        {
            Id = Guid.NewGuid(),
            RoleId = roleId,
            MenuId = item.MenuId,
            PermissionKey = item.PermissionKey.Trim()
        }).ToList();

        if (items.Count > 0)
            _db.RoleMenus.AddRange(items);

        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<IReadOnlyList<RoleMenuAssignmentResponse>?> GetRoleMenusAsync(Guid roleId, CancellationToken ct)
    {
        var role = await _roleManager.Roles.FirstOrDefaultAsync(x => x.Id == roleId, ct);
        if (role is null) return null;

        return await _db.RoleMenus
            .AsNoTracking()
            .Where(x => x.RoleId == roleId)
            .Select(x => new RoleMenuAssignmentResponse(x.MenuId, x.PermissionKey))
            .ToListAsync(ct);
    }
}
