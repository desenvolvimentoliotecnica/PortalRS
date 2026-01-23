using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Roles;
using RhPortal.Api.Contracts.Roles;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/roles")]
public sealed class RolesController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public RolesController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [RequirePermission("roles.manage")]
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RoleListItemResponse>>> List(
        [FromServices] RoleAdministrationService service,
        CancellationToken ct)
    {
        var items = await service.ListAsync(ct);
        return Ok(items);
    }

    [RequirePermission("roles.manage")]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<RoleResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] RoleAdministrationService service,
        CancellationToken ct)
    {
        var item = await service.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [RequirePermission("roles.manage")]
    [HttpPost]
    public async Task<ActionResult<RoleResponse>> Create(
        [FromBody] RoleCreateRequest request,
        [FromServices] RoleAdministrationService service,
        CancellationToken ct)
    {
        try
        {
            var created = await service.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ProblemDetails
            {
                Title = _localizer["ControllerErrors.UnableToCreateRoleTitle"],
                Detail = ex.Message,
                Status = StatusCodes.Status409Conflict
            });
        }
    }

    [RequirePermission("roles.manage")]
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<RoleResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] RoleUpdateRequest request,
        [FromServices] RoleAdministrationService service,
        CancellationToken ct)
    {
        try
        {
            var updated = await service.UpdateAsync(id, request, ct);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ProblemDetails
            {
                Title = _localizer["ControllerErrors.UnableToUpdateRoleTitle"],
                Detail = ex.Message,
                Status = StatusCodes.Status409Conflict
            });
        }
    }

    [RequirePermission("roles.manage")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] RoleAdministrationService service,
        CancellationToken ct)
    {
        var deleted = await service.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }

    [RequirePermission("roles.manage")]
    [HttpPut("{id:guid}/menus")]
    public async Task<IActionResult> UpdateMenus(
        [FromRoute] Guid id,
        [FromBody] RoleMenusUpdateRequest request,
        [FromServices] RoleAdministrationService service,
        CancellationToken ct)
    {
        try
        {
            var updated = await service.UpdateRoleMenusAsync(id, request, ct);
            return updated ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ProblemDetails
            {
                Title = _localizer["ControllerErrors.UnableToUpdateRoleMenusTitle"],
                Detail = ex.Message,
                Status = StatusCodes.Status409Conflict
            });
        }
    }

    [RequirePermission("roles.manage")]
    [HttpGet("{id:guid}/menus")]
    public async Task<ActionResult<IReadOnlyList<RoleMenuAssignmentResponse>>> GetMenus(
        [FromRoute] Guid id,
        [FromServices] RoleAdministrationService service,
        CancellationToken ct)
    {
        var items = await service.GetRoleMenusAsync(id, ct);
        return items is null ? NotFound() : Ok(items);
    }
}
