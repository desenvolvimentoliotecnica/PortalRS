using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels.Admin;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public sealed class AdminAccessesController : Controller
{
    private readonly RolesApiClient _rolesApi;
    private readonly MenusApiClient _menusApi;

    public AdminAccessesController(RolesApiClient rolesApi, MenusApiClient menusApi)
    {
        _rolesApi = rolesApi;
        _menusApi = menusApi;
    }

    [RequirePermission("access.manage")]
    [HttpGet("/Admin/Accesses")]
    public async Task<IActionResult> Index([FromQuery] Guid? roleId, CancellationToken ct)
    {
        var roles = await _rolesApi.ListAsync(ct);
        var menus = await _menusApi.ListAsync(ct);

        var assignments = roleId.HasValue
            ? await _rolesApi.GetRoleMenusAsync(roleId.Value, ct)
            : Array.Empty<RoleMenuAssignmentViewModel>();

        return View(new AccessesPageViewModel
        {
            Roles = roles,
            Menus = menus,
            RoleMenus = assignments,
            SelectedRoleId = roleId
        });
    }

    [RequirePermission("access.manage")]
    [HttpPost("/Admin/Accesses")]
    public async Task<IActionResult> Update([FromForm] AccessesFormModel model, CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return RedirectToAction(nameof(Index), new { roleId = model.RoleId });

        var menus = await _menusApi.ListAsync(ct);
        var menuByPermission = menus.ToDictionary(x => x.PermissionKey, x => x);

        var items = new List<RoleMenuAssignmentViewModel>();
        foreach (var permission in model.SelectedPermissions.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (menuByPermission.TryGetValue(permission, out var menu))
            {
                items.Add(new RoleMenuAssignmentViewModel(menu.Id, permission));
                continue;
            }

            if (string.Equals(permission, "users.write", StringComparison.OrdinalIgnoreCase) &&
                menuByPermission.TryGetValue("users.read", out var usersMenu))
            {
                items.Add(new RoleMenuAssignmentViewModel(usersMenu.Id, "users.write"));
            }
        }

        var request = new RolesApiClient.RoleMenusUpdateRequest(items);
        await _rolesApi.UpdateRoleMenusAsync(model.RoleId, request, ct);

        return RedirectToAction(nameof(Index), new { roleId = model.RoleId });
    }
}
