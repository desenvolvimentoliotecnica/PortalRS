using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public class UsuariosPerfisController : Controller
{
    private readonly UsersApiClient _usersApi;
    private readonly RolesApiClient _rolesApi;
    private readonly MenusApiClient _menusApi;

    public UsuariosPerfisController(
        UsersApiClient usersApi,
        RolesApiClient rolesApi,
        MenusApiClient menusApi)
    {
        _usersApi = usersApi;
        _rolesApi = rolesApi;
        _menusApi = menusApi;
    }

    public IActionResult Index()
    {
        var model = new PageSeedViewModel { SeedJson = "{}" };
        return View(model);
    }

    [HttpGet("/UsuariosPerfis/_api/users")]
    public async Task<IActionResult> ListUsers(CancellationToken ct)
    {
        var users = await _usersApi.ListAsync(ct);
        return Ok(users);
    }

    [HttpGet("/UsuariosPerfis/_api/users/{id:guid}")]
    public async Task<IActionResult> GetUser([FromRoute] Guid id, CancellationToken ct)
    {
        var user = await _usersApi.GetByIdAsync(id, ct);
        return user is null ? NotFound() : Ok(user);
    }

    [HttpPost("/UsuariosPerfis/_api/users")]
    public async Task<IActionResult> CreateUser([FromBody] UsersApiClient.UserCreateRequest request, CancellationToken ct)
    {
        var created = await _usersApi.CreateAsync(request, ct);
        return created is null ? BadRequest() : Ok(created);
    }

    [HttpPut("/UsuariosPerfis/_api/users/{id:guid}")]
    public async Task<IActionResult> UpdateUser([FromRoute] Guid id, [FromBody] UsersApiClient.UserUpdateRequest request, CancellationToken ct)
    {
        var updated = await _usersApi.UpdateAsync(id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPatch("/UsuariosPerfis/_api/users/{id:guid}/status")]
    public async Task<IActionResult> UpdateUserStatus([FromRoute] Guid id, [FromBody] UsersApiClient.UserStatusUpdateRequest request, CancellationToken ct)
    {
        var updated = await _usersApi.UpdateStatusAsync(id, request.IsActive, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPut("/UsuariosPerfis/_api/users/{id:guid}/roles")]
    public async Task<IActionResult> UpdateUserRoles([FromRoute] Guid id, [FromBody] UsersApiClient.UserRolesUpdateRequest request, CancellationToken ct)
    {
        var updated = await _usersApi.UpdateRolesAsync(id, request.RoleIds, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPut("/UsuariosPerfis/_api/users/{id:guid}/password")]
    public async Task<IActionResult> SetUserPassword([FromRoute] Guid id, [FromBody] UsersApiClient.UserPasswordUpdateRequest request, CancellationToken ct)
    {
        var updated = await _usersApi.SetPasswordAsync(id, request.NewPassword, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpGet("/UsuariosPerfis/_api/roles")]
    public async Task<IActionResult> ListRoles(CancellationToken ct)
    {
        var roles = await _rolesApi.ListAsync(ct);
        return Ok(roles);
    }

    [HttpGet("/UsuariosPerfis/_api/roles/{id:guid}")]
    public async Task<IActionResult> GetRole([FromRoute] Guid id, CancellationToken ct)
    {
        var role = await _rolesApi.GetByIdAsync(id, ct);
        return role is null ? NotFound() : Ok(role);
    }

    [HttpPost("/UsuariosPerfis/_api/roles")]
    public async Task<IActionResult> CreateRole([FromBody] RolesApiClient.RoleCreateRequest request, CancellationToken ct)
    {
        var created = await _rolesApi.CreateAsync(request, ct);
        return created is null ? BadRequest() : Ok(created);
    }

    [HttpPut("/UsuariosPerfis/_api/roles/{id:guid}")]
    public async Task<IActionResult> UpdateRole([FromRoute] Guid id, [FromBody] RolesApiClient.RoleUpdateRequest request, CancellationToken ct)
    {
        var updated = await _rolesApi.UpdateAsync(id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("/UsuariosPerfis/_api/roles/{id:guid}")]
    public async Task<IActionResult> DeleteRole([FromRoute] Guid id, CancellationToken ct)
    {
        var ok = await _rolesApi.DeleteAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }

    [HttpGet("/UsuariosPerfis/_api/roles/{id:guid}/menus")]
    public async Task<IActionResult> GetRoleMenus([FromRoute] Guid id, CancellationToken ct)
    {
        var items = await _rolesApi.GetRoleMenusAsync(id, ct);
        return Ok(items);
    }

    [HttpPut("/UsuariosPerfis/_api/roles/{id:guid}/menus")]
    public async Task<IActionResult> UpdateRoleMenus([FromRoute] Guid id, [FromBody] RolesApiClient.RoleMenusUpdateRequest request, CancellationToken ct)
    {
        var ok = await _rolesApi.UpdateRoleMenusAsync(id, request, ct);
        return ok ? NoContent() : BadRequest();
    }

    [HttpGet("/UsuariosPerfis/_api/menus")]
    public async Task<IActionResult> ListMenus(CancellationToken ct)
    {
        var menus = await _menusApi.ListAsync(ct);
        return Ok(menus);
    }

    [HttpGet("/UsuariosPerfis/_api/menus/{id:guid}")]
    public async Task<IActionResult> GetMenu([FromRoute] Guid id, CancellationToken ct)
    {
        var menu = await _menusApi.GetByIdAsync(id, ct);
        return menu is null ? NotFound() : Ok(menu);
    }

    [HttpPost("/UsuariosPerfis/_api/menus")]
    public async Task<IActionResult> CreateMenu([FromBody] MenusApiClient.MenuCreateRequest request, CancellationToken ct)
    {
        var created = await _menusApi.CreateAsync(request, ct);
        return created is null ? BadRequest() : Ok(created);
    }

    [HttpPut("/UsuariosPerfis/_api/menus/{id:guid}")]
    public async Task<IActionResult> UpdateMenu([FromRoute] Guid id, [FromBody] MenusApiClient.MenuUpdateRequest request, CancellationToken ct)
    {
        var updated = await _menusApi.UpdateAsync(id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("/UsuariosPerfis/_api/menus/{id:guid}")]
    public async Task<IActionResult> DeleteMenu([FromRoute] Guid id, CancellationToken ct)
    {
        var ok = await _menusApi.DeleteAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }
}
