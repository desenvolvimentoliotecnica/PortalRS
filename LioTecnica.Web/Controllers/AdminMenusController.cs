using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels.Admin;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public sealed class AdminMenusController : Controller
{
    private readonly MenusApiClient _menusApi;

    public AdminMenusController(MenusApiClient menusApi)
    {
        _menusApi = menusApi;
    }

    [RequirePermission("menus.manage")]
    [HttpGet("/Admin/Menus")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var menus = await _menusApi.ListAsync(ct);
        return View(new MenusPageViewModel { Menus = menus });
    }

    [RequirePermission("menus.manage")]
    [HttpGet("/Admin/Menus/New")]
    public IActionResult New()
    {
        return View("Edit", new MenuFormModel());
    }

    [RequirePermission("menus.manage")]
    [HttpPost("/Admin/Menus/New")]
    public async Task<IActionResult> Create([FromForm] MenuFormModel model, CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return View("Edit", model);

        var request = new MenusApiClient.MenuCreateRequest(
            model.DisplayName.Trim(),
            model.Route.Trim(),
            model.Icon?.Trim() ?? string.Empty,
            model.Order,
            model.ParentId,
            model.PermissionKey.Trim(),
            model.IsActive
        );

        var created = await _menusApi.CreateAsync(request, ct);
        if (created is null)
        {
            ModelState.AddModelError(string.Empty, "Unable to create menu.");
            return View("Edit", model);
        }

        return RedirectToAction(nameof(Index));
    }

    [RequirePermission("menus.manage")]
    [HttpGet("/Admin/Menus/Edit/{id:guid}")]
    public async Task<IActionResult> Edit([FromRoute] Guid id, CancellationToken ct)
    {
        var menu = await _menusApi.GetByIdAsync(id, ct);
        if (menu is null) return NotFound();

        var model = new MenuFormModel
        {
            Id = menu.Id,
            DisplayName = menu.DisplayName,
            Route = menu.Route,
            Icon = menu.Icon,
            Order = menu.Order,
            ParentId = menu.ParentId,
            PermissionKey = menu.PermissionKey,
            IsActive = menu.IsActive
        };

        return View(model);
    }

    [RequirePermission("menus.manage")]
    [HttpPost("/Admin/Menus/Edit/{id:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromForm] MenuFormModel model, CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return View("Edit", model);

        var request = new MenusApiClient.MenuUpdateRequest(
            model.DisplayName.Trim(),
            model.Route.Trim(),
            model.Icon?.Trim() ?? string.Empty,
            model.Order,
            model.ParentId,
            model.PermissionKey.Trim(),
            model.IsActive
        );

        var updated = await _menusApi.UpdateAsync(id, request, ct);
        if (updated is null)
        {
            ModelState.AddModelError(string.Empty, "Unable to update menu.");
            return View("Edit", model);
        }

        return RedirectToAction(nameof(Index));
    }
}
