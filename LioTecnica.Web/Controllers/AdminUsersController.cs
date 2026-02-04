using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels.Admin;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Web.Infrastructure.ApiClients;

namespace LioTecnica.Web.Controllers;

public sealed class AdminUsersController : Controller
{
    private readonly UsersApiClient _usersApi;
    private readonly RolesApiClient _rolesApi;
    private readonly UnitsApiClient _unitsApi;
    private readonly FuncionariosApiClient _funcionariosApi;
    private readonly PortalTenantContext _tenantContext;

    public AdminUsersController(
        UsersApiClient usersApi,
        RolesApiClient rolesApi,
        UnitsApiClient unitsApi,
        FuncionariosApiClient funcionariosApi,
        PortalTenantContext tenantContext)
    {
        _usersApi = usersApi;
        _rolesApi = rolesApi;
        _unitsApi = unitsApi;
        _funcionariosApi = funcionariosApi;
        _tenantContext = tenantContext;
    }

    [RequirePermission("users.read")]
    [HttpGet("/Admin/Users")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var users = await _usersApi.ListAsync(ct);
        var roles = await _rolesApi.ListAsync(ct);

        return View(new UsersPageViewModel
        {
            Users = users,
            Roles = roles
        });
    }

    [RequirePermission("users.write")]
    [HttpGet("/Admin/Users/New")]
    public async Task<IActionResult> New(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var (roles, units, funcionarios) = await LoadRolesUnitsFuncionariosAsync(tenantId, ct);
        return View("Edit", new UserEditViewModel
        {
            IsNew = true,
            Roles = roles,
            Units = units,
            Funcionarios = funcionarios
        });
    }

    [RequirePermission("users.write")]
    [HttpPost("/Admin/Users/New")]
    public async Task<IActionResult> Create([FromForm] UserFormModel model, CancellationToken ct)
    {
        if (!ModelState.IsValid || string.IsNullOrWhiteSpace(model.Password) || model.Password.Length < 8)
        {
            var tenantId = _tenantContext.TenantId ?? "";
            var (roles, units, funcionarios) = await LoadRolesUnitsFuncionariosAsync(tenantId, ct);
            ModelState.AddModelError(nameof(model.Password), string.IsNullOrWhiteSpace(model.Password) ? "A senha é obrigatória." : "A senha deve ter no mínimo 8 caracteres.");
            return View("Edit", new UserEditViewModel
            {
                IsNew = true,
                User = model,
                Roles = roles,
                Units = units,
                Funcionarios = funcionarios
            });
        }

        var request = new UsersApiClient.UserCreateRequest(
            model.Email.Trim(),
            model.FullName.Trim(),
            model.Password,
            model.IsActive,
            model.RoleIds,
            model.UnitIds?.Count > 0 ? model.UnitIds : null,
            model.FuncionarioId
        );

        var created = await _usersApi.CreateAsync(request, ct);
        if (created is null)
        {
            var tenantId = _tenantContext.TenantId ?? "";
            var (roles, units, funcionarios) = await LoadRolesUnitsFuncionariosAsync(tenantId, ct);
            ModelState.AddModelError(string.Empty, "Unable to create user.");
            return View("Edit", new UserEditViewModel
            {
                IsNew = true,
                User = model,
                Roles = roles,
                Units = units,
                Funcionarios = funcionarios
            });
        }

        return RedirectToAction(nameof(Index));
    }

    [RequirePermission("users.write")]
    [HttpGet("/Admin/Users/Edit/{id:guid}")]
    public async Task<IActionResult> Edit([FromRoute] Guid id, CancellationToken ct)
    {
        var user = await _usersApi.GetByIdAsync(id, ct);
        if (user is null) return NotFound();

        var tenantId = _tenantContext.TenantId ?? "";
        var (roles, units, funcionarios) = await LoadRolesUnitsFuncionariosAsync(tenantId, ct);
        var form = new UserFormModel
        {
            Id = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            IsActive = user.IsActive,
            RoleIds = user.Roles.Select(r => r.Id).ToList(),
            FuncionarioId = user.Funcionario?.Id,
            UnitIds = user.Units?.Select(u => u.Id).ToList() ?? new List<Guid>()
        };

        return View(new UserEditViewModel
        {
            IsNew = false,
            User = form,
            Roles = roles,
            Units = units,
            Funcionarios = funcionarios
        });
    }

    [RequirePermission("users.write")]
    [HttpPost("/Admin/Users/Edit/{id:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromForm] UserFormModel model, CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            var tenantId = _tenantContext.TenantId ?? "";
            var (roles, units, funcionarios) = await LoadRolesUnitsFuncionariosAsync(tenantId, ct);
            return View("Edit", new UserEditViewModel
            {
                IsNew = false,
                User = model,
                Roles = roles,
                Units = units,
                Funcionarios = funcionarios
            });
        }

        var updateRequest = new UsersApiClient.UserUpdateRequest(
            model.Email.Trim(),
            model.FullName.Trim(),
            model.IsActive,
            model.UnitIds?.Count > 0 ? model.UnitIds : null,
            model.FuncionarioId
        );

        var updated = await _usersApi.UpdateAsync(id, updateRequest, ct);
        if (updated is null)
        {
            var tenantId = _tenantContext.TenantId ?? "";
            var (roles, units, funcionarios) = await LoadRolesUnitsFuncionariosAsync(tenantId, ct);
            ModelState.AddModelError(string.Empty, "Unable to update user.");
            return View("Edit", new UserEditViewModel
            {
                IsNew = false,
                User = model,
                Roles = roles,
                Units = units,
                Funcionarios = funcionarios
            });
        }

        await _usersApi.UpdateRolesAsync(id, model.RoleIds, ct);

        return RedirectToAction(nameof(Index));
    }

    private async Task<(IReadOnlyList<RoleListItemViewModel> Roles, IReadOnlyList<UnitInfoViewModel> Units, IReadOnlyList<FuncionarioInfoViewModel> Funcionarios)> LoadRolesUnitsFuncionariosAsync(string tenantId, CancellationToken ct)
    {
        var rolesTask = _rolesApi.ListAsync(ct);
        var unitsTask = tenantId.Length > 0 ? _unitsApi.GetUnitsAsync(tenantId, ct) : Task.FromResult(new UnitsPagedResponse());
        var funcionariosTask = tenantId.Length > 0 ? _funcionariosApi.GetFuncionariosAsync(tenantId, null, null, null, null, null, 1, 500, null, null, ct) : Task.FromResult(new FuncionariosPagedResponse());

        await Task.WhenAll(rolesTask, unitsTask, funcionariosTask);

        var roles = await rolesTask;
        var unitsResp = await unitsTask;
        var funcionariosResp = await funcionariosTask;

        var units = (unitsResp.Items ?? new List<UnitApiItem>())
            .Select(u => new UnitInfoViewModel(u.Id, u.Code ?? "", u.Name ?? ""))
            .ToList();
        var funcionarios = (funcionariosResp.Items ?? new List<FuncionarioApiItem>())
            .Select(m => new FuncionarioInfoViewModel(m.Id, m.Name ?? "", m.Email))
            .ToList();

        return (roles, units, funcionarios);
    }
}
