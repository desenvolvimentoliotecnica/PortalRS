using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels.Admin;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public sealed class AdminRolesController : Controller
{
    private readonly RolesApiClient _rolesApi;

    public AdminRolesController(RolesApiClient rolesApi)
    {
        _rolesApi = rolesApi;
    }

    [RequirePermission("roles.manage")]
    [HttpGet("/Admin/Roles")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var roles = await _rolesApi.ListAsync(ct);
        return View(new RolesPageViewModel { Roles = roles });
    }

    [RequirePermission("roles.manage")]
    [HttpGet("/Admin/Roles/New")]
    public IActionResult New()
    {
        return View("Edit", new RoleFormModel());
    }

    [RequirePermission("roles.manage")]
    [HttpPost("/Admin/Roles/New")]
    public async Task<IActionResult> Create([FromForm] RoleFormModel model, CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return View("Edit", model);

        var request = new RolesApiClient.RoleCreateRequest(
            model.Name.Trim(),
            model.Description?.Trim() ?? string.Empty,
            model.IsActive,
            model.VisibilityScope,
            model.VagasDataScope,
            model.AccessMode
        );

        var created = await _rolesApi.CreateAsync(request, ct);
        if (created is null)
        {
            ModelState.AddModelError(string.Empty, "Unable to create role.");
            return View("Edit", model);
        }

        return RedirectToAction(nameof(Index));
    }

    [RequirePermission("roles.manage")]
    [HttpGet("/Admin/Roles/Edit/{id:guid}")]
    public async Task<IActionResult> Edit([FromRoute] Guid id, CancellationToken ct)
    {
        var role = await _rolesApi.GetByIdAsync(id, ct);
        if (role is null) return NotFound();

        var model = new RoleFormModel
        {
            Id = role.Id,
            Name = role.Name,
            Description = role.Description,
            IsActive = role.IsActive,
            VisibilityScope = role.VisibilityScope,
            VagasDataScope = role.VagasDataScope,
            AccessMode = role.AccessMode
        };

        return View(model);
    }

    [RequirePermission("roles.manage")]
    [HttpPost("/Admin/Roles/Edit/{id:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromForm] RoleFormModel model, CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return View("Edit", model);

        var request = new RolesApiClient.RoleUpdateRequest(
            model.Name.Trim(),
            model.Description?.Trim() ?? string.Empty,
            model.IsActive,
            model.VisibilityScope,
            model.VagasDataScope,
            model.AccessMode
        );

        var updated = await _rolesApi.UpdateAsync(id, request, ct);
        if (updated is null)
        {
            ModelState.AddModelError(string.Empty, "Unable to update role.");
            return View("Edit", model);
        }

        return RedirectToAction(nameof(Index));
    }
}
