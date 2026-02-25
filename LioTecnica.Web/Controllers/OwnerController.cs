using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace LioTecnica.Web.Controllers;

[Authorize(Policy = "OwnerOrCookie")]
public sealed class OwnerController : Controller
{
    private readonly OwnerTenantsApiClient _ownerTenantsApi;
    private readonly OwnerTenantUsersApiClient _ownerTenantUsersApi;
    private readonly RolesApiClient _rolesApi;
    private readonly MenusApiClient _menusApi;
    private readonly AuditLogsApiClient _auditLogsApi;
    private readonly OperationalLogsApiClient _operationalLogsApi;
    private readonly EmailTemplatesApiClient _emailTemplatesApi;
    private readonly EmailMessagesApiClient _emailMessagesApi;
    private readonly EmailConfigApiClient _emailConfigApi;
    private readonly EntraIdConfigApiClient _entraIdConfigApi;
    private readonly LocalizationConfigApiClient _localizationConfigApi;
    private readonly OwnerAiApiClient _ownerAiApi;

    [ActivatorUtilitiesConstructor]
    public OwnerController(
        OwnerTenantsApiClient ownerTenantsApi,
        OwnerTenantUsersApiClient ownerTenantUsersApi,
        RolesApiClient rolesApi,
        MenusApiClient menusApi,
        AuditLogsApiClient auditLogsApi,
        OperationalLogsApiClient operationalLogsApi,
        EmailTemplatesApiClient emailTemplatesApi,
        EmailMessagesApiClient emailMessagesApi,
        EmailConfigApiClient emailConfigApi,
        EntraIdConfigApiClient entraIdConfigApi,
        LocalizationConfigApiClient localizationConfigApi,
        OwnerAiApiClient ownerAiApi)
    {
        _ownerTenantsApi = ownerTenantsApi;
        _ownerTenantUsersApi = ownerTenantUsersApi;
        _rolesApi = rolesApi;
        _menusApi = menusApi;
        _auditLogsApi = auditLogsApi;
        _operationalLogsApi = operationalLogsApi;
        _emailTemplatesApi = emailTemplatesApi;
        _emailMessagesApi = emailMessagesApi;
        _emailConfigApi = emailConfigApi;
        _entraIdConfigApi = entraIdConfigApi;
        _localizationConfigApi = localizationConfigApi;
        _ownerAiApi = ownerAiApi;
    }

    /// <summary>Validates tenant and sets OwnerConfigTenantId (Items + cookie). Returns redirect if invalid.</summary>
    private async Task<IActionResult?> EnsureOwnerConfigTenantAsync(string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            TempData["OwnerError"] = "TenantId inválido.";
            return RedirectToAction(nameof(Tenants));
        }
        var tid = tenantId.Trim().ToLowerInvariant();
        var tenant = await _ownerTenantsApi.GetTenantAsync(tid, ct);
        if (tenant is null)
        {
            TempData["OwnerError"] = "Tenant não encontrado.";
            return RedirectToAction(nameof(Tenants));
        }
        HttpContext.Items[ApiAuthenticationHandler.OwnerConfigTenantIdKey] = tid;
        Response.Cookies.Append("OwnerConfigTenantId", tid, new CookieOptions { Path = "/", SameSite = SameSiteMode.Lax, MaxAge = TimeSpan.FromHours(1) });
        return null;
    }

    [HttpGet("/Owner")]
    public IActionResult Index()
    {
        return RedirectToAction(nameof(Tenants));
    }

    [HttpGet("/Owner/IA")]
    public IActionResult IA()
    {
        ViewData["OwnerConfigApiBase"] = Url.Action(nameof(IA), "Owner");
        return View("IA/Index");
    }

    [HttpGet("/Owner/IA/_api/keys")]
    public async Task<IActionResult> IAApiKeys(CancellationToken ct)
    {
        var list = await _ownerAiApi.ListKeysAsync(ct);
        return list is null ? Unauthorized() : Ok(list);
    }

    [HttpPost("/Owner/IA/_api/keys")]
    public async Task<IActionResult> IAApiCreateKey([FromBody] AiProviderKeyCreateRequest request, CancellationToken ct)
    {
        if (request is null) return BadRequest();
        var created = await _ownerAiApi.CreateKeyAsync(request, ct);
        return created is null ? BadRequest() : Ok(created);
    }

    [HttpPut("/Owner/IA/_api/keys/{id:guid}")]
    public async Task<IActionResult> IAApiUpdateKey(Guid id, [FromBody] AiProviderKeyUpdateRequest request, CancellationToken ct)
    {
        if (request is null) return BadRequest();
        var updated = await _ownerAiApi.UpdateKeyAsync(id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("/Owner/IA/_api/keys/{id:guid}")]
    public async Task<IActionResult> IAApiDeleteKey(Guid id, CancellationToken ct)
    {
        var deleted = await _ownerAiApi.DeleteKeyAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }

    [HttpGet("/Owner/IA/_api/models")]
    public async Task<IActionResult> IAApiModels(CancellationToken ct)
    {
        var list = await _ownerAiApi.ListModelsAsync(ct);
        return list is null ? Unauthorized() : Ok(list);
    }

    [HttpPost("/Owner/IA/_api/models")]
    public async Task<IActionResult> IAApiCreateModel([FromBody] AiModelCreateRequest request, CancellationToken ct)
    {
        if (request is null) return BadRequest();
        var created = await _ownerAiApi.CreateModelAsync(request, ct);
        return created is null ? BadRequest() : Ok(created);
    }

    [HttpPut("/Owner/IA/_api/models/{id:guid}")]
    public async Task<IActionResult> IAApiUpdateModel(Guid id, [FromBody] AiModelUpdateRequest request, CancellationToken ct)
    {
        if (request is null) return BadRequest();
        var updated = await _ownerAiApi.UpdateModelAsync(id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("/Owner/IA/_api/models/{id:guid}")]
    public async Task<IActionResult> IAApiDeleteModel(Guid id, CancellationToken ct)
    {
        var deleted = await _ownerAiApi.DeleteModelAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }

    [HttpGet("/Owner/IA/_api/usage/summary-by-tenant")]
    public async Task<IActionResult> IAApiUsageSummaryByTenant([FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, CancellationToken ct)
    {
        var result = await _ownerAiApi.GetUsageSummaryByTenantAsync(from, to, ct);
        return result is null ? Unauthorized() : Ok(result);
    }

    [HttpGet("/Owner/IA/_api/usage/summary-by-user")]
    public async Task<IActionResult> IAApiUsageSummaryByUser([FromQuery] string? tenantId, [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, CancellationToken ct)
    {
        var result = await _ownerAiApi.GetUsageSummaryByUserAsync(tenantId, from, to, ct);
        return result is null ? Unauthorized() : Ok(result);
    }

    [HttpGet("/Owner/IA/_api/usage/detail")]
    public async Task<IActionResult> IAApiUsageDetail([FromQuery] string? tenantId, [FromQuery] Guid? userId, [FromQuery] string? module, [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        var result = await _ownerAiApi.GetUsageDetailAsync(tenantId, userId, module, from, to, page, pageSize, ct);
        return result is null ? Unauthorized() : Ok(result);
    }

    [HttpGet("/Owner/Tenants")]
    public async Task<IActionResult> Tenants(CancellationToken ct)
    {
        Response.Cookies.Delete("OwnerConfigTenantId", new CookieOptions { Path = "/" });
        IReadOnlyList<TenantListItemDto>? list;
        try
        {
            list = await _ownerTenantsApi.ListTenantsAsync(ct);
        }
        catch (System.Net.Http.HttpRequestException)
        {
            list = null;
        }
        catch (TaskCanceledException)
        {
            list = null;
        }

        if (list is null)
        {
            TempData["OwnerError"] = "Não foi possível carregar a lista de tenants. Verifique se a API está rodando (ex.: http://localhost:5056).";
            return View("Tenants/Index", Array.Empty<TenantWithStatusDto>());
        }

        IReadOnlyList<TenantMigrationStatusDto>? statusList = null;
        try
        {
            statusList = await _ownerTenantsApi.GetMigrationStatusAsync(ct);
        }
        catch
        {
            // Mostra a lista mesmo sem status de migrações
        }
        var statusByTenant = statusList?.ToDictionary(s => s.TenantId, StringComparer.OrdinalIgnoreCase) ?? new Dictionary<string, TenantMigrationStatusDto>();

        var withStatus = list.Select(t =>
        {
            var st = statusByTenant.GetValueOrDefault(t.TenantId);
            return new TenantWithStatusDto(
                t.TenantId,
                t.Name,
                t.IsActive,
                t.CreatedAtUtc,
                t.UpdatedAtUtc,
                st?.IsUpToDate,
                st?.PendingCount ?? 0,
                st?.ErrorMessage
            );
        }).ToList();

        return View("Tenants/Index", withStatus);
    }

    [HttpGet("/Owner/Tenants/{tenantId}")]
    public async Task<IActionResult> Details(string tenantId, CancellationToken ct)
    {
        Response.Cookies.Delete("OwnerConfigTenantId", new CookieOptions { Path = "/" });
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            TempData["OwnerError"] = "TenantId inválido.";
            return RedirectToAction(nameof(Tenants));
        }
        var tenant = await _ownerTenantsApi.GetTenantAsync(tenantId, ct);
        if (tenant is null)
        {
            TempData["OwnerError"] = "Tenant não encontrado.";
            return RedirectToAction(nameof(Tenants));
        }
        TenantMigrationStatusDto? migrationStatus = null;
        try
        {
            var statusList = await _ownerTenantsApi.GetMigrationStatusAsync(ct);
            migrationStatus = statusList?.FirstOrDefault(s => string.Equals(s.TenantId, tenantId, StringComparison.OrdinalIgnoreCase));
        }
        catch { }
        ViewData["MigrationStatus"] = migrationStatus;
        return View("Tenants/Details", tenant);
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Acessos")]
    public async Task<IActionResult> ConfigAcessos(string tenantId, [FromQuery] Guid? roleId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var tid = tenantId!.Trim().ToLowerInvariant();
        ViewData["ConfigBasePath"] = Url.Action("ConfigAcessos", "Owner", new { tenantId = tid });

        var roles = await _rolesApi.ListAsync(ct);
        var menus = await _menusApi.ListAsync(ct);
        var assignments = roleId.HasValue ? await _rolesApi.GetRoleMenusAsync(roleId.Value, ct) : Array.Empty<RoleMenuAssignmentViewModel>();
        return View("~/Views/AdminAccesses/Index.cshtml", new AccessesPageViewModel
        {
            Roles = roles,
            Menus = menus,
            RoleMenus = assignments,
            SelectedRoleId = roleId
        });
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Config/Acessos")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ConfigAcessos(string tenantId, [FromForm] AccessesFormModel model, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var tid = tenantId!.Trim().ToLowerInvariant();
        if (!ModelState.IsValid)
            return RedirectToAction(nameof(ConfigAcessos), new { tenantId = tid, roleId = model.RoleId });

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
            if (string.Equals(permission, "users.write", StringComparison.OrdinalIgnoreCase) && menuByPermission.TryGetValue("users.read", out var usersMenu))
                items.Add(new RoleMenuAssignmentViewModel(usersMenu.Id, "users.write"));
        }
        await _rolesApi.UpdateRoleMenusAsync(model.RoleId, new RolesApiClient.RoleMenusUpdateRequest(items), ct);
        TempData["OwnerSuccess"] = "Acessos atualizados.";
        return RedirectToAction(nameof(ConfigAcessos), new { tenantId = tid, roleId = model.RoleId });
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Menus")]
    public async Task<IActionResult> ConfigMenus(string tenantId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var tid = tenantId!.Trim().ToLowerInvariant();
        ViewData["ConfigBasePath"] = Url.Action("ConfigMenus", "Owner", new { tenantId = tid });

        var menus = await _menusApi.ListAsync(ct);
        return View("~/Views/AdminMenus/Index.cshtml", new MenusPageViewModel { Menus = menus });
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Menus/New")]
    public async Task<IActionResult> ConfigMenusNew(string tenantId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var tid = tenantId!.Trim().ToLowerInvariant();
        ViewData["ConfigBasePath"] = Url.Action("ConfigMenus", "Owner", new { tenantId = tid });
        return View("~/Views/AdminMenus/Edit.cshtml", new MenuFormModel());
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Config/Menus/New")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ConfigMenusNew(string tenantId, [FromForm] MenuFormModel model, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var tid = tenantId!.Trim().ToLowerInvariant();
        if (!ModelState.IsValid)
            return View("~/Views/AdminMenus/Edit.cshtml", model);

        var request = new MenusApiClient.MenuCreateRequest(model.DisplayName.Trim(), model.Route.Trim(), model.Icon?.Trim() ?? string.Empty, model.Order, model.ParentId, model.PermissionKey.Trim(), model.IsActive);
        var created = await _menusApi.CreateAsync(request, ct);
        if (created is null)
        {
            ModelState.AddModelError(string.Empty, "Não foi possível criar o menu.");
            return View("~/Views/AdminMenus/Edit.cshtml", model);
        }
        TempData["OwnerSuccess"] = "Menu criado.";
        return RedirectToAction(nameof(ConfigMenus), new { tenantId = tid });
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Menus/Edit/{id:guid}")]
    public async Task<IActionResult> ConfigMenusEdit(string tenantId, Guid id, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var tid = tenantId!.Trim().ToLowerInvariant();
        ViewData["ConfigBasePath"] = Url.Action("ConfigMenus", "Owner", new { tenantId = tid });

        var menu = await _menusApi.GetByIdAsync(id, ct);
        if (menu is null) return NotFound();
        var form = new MenuFormModel { Id = menu.Id, DisplayName = menu.DisplayName, Route = menu.Route, Icon = menu.Icon, Order = menu.Order, ParentId = menu.ParentId, PermissionKey = menu.PermissionKey, IsActive = menu.IsActive };
        return View("~/Views/AdminMenus/Edit.cshtml", form);
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Config/Menus/Edit/{id:guid}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ConfigMenusEdit(string tenantId, Guid id, [FromForm] MenuFormModel model, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var tid = tenantId!.Trim().ToLowerInvariant();
        if (!ModelState.IsValid)
            return View("~/Views/AdminMenus/Edit.cshtml", model);

        var request = new MenusApiClient.MenuUpdateRequest(model.DisplayName.Trim(), model.Route.Trim(), model.Icon?.Trim() ?? string.Empty, model.Order, model.ParentId, model.PermissionKey.Trim(), model.IsActive);
        var updated = await _menusApi.UpdateAsync(id, request, ct);
        if (updated is null)
        {
            ModelState.AddModelError(string.Empty, "Não foi possível atualizar o menu.");
            return View("~/Views/AdminMenus/Edit.cshtml", model);
        }
        TempData["OwnerSuccess"] = "Menu atualizado.";
        return RedirectToAction(nameof(ConfigMenus), new { tenantId = tid });
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Logs")]
    public async Task<IActionResult> ConfigLogs(string tenantId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var tid = tenantId!.Trim().ToLowerInvariant();
        ViewData["OwnerConfigApiBase"] = Url.Action(nameof(ConfigLogs), "Owner", new { tenantId = tid });
        return View("~/Views/AdminLogs/Index.cshtml", new AuditLogsPageViewModel("Logs Transacionais"));
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Logs/_api/transactions")]
    public async Task<IActionResult> ConfigLogsApiTransactions(string tenantId, [FromQuery] AuditLogsQuery query, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var response = await _auditLogsApi.ListAsync(query, ct);
        return response is null ? Unauthorized() : Ok(response);
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Logs/_api/transactions/{id:guid}")]
    public async Task<IActionResult> ConfigLogsApiTransactionById(string tenantId, Guid id, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var response = await _auditLogsApi.GetByIdAsync(id, ct);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Logs/_api/summary")]
    public async Task<IActionResult> ConfigLogsApiSummary(string tenantId, [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, [FromQuery] int top = 6, CancellationToken ct = default)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var response = await _auditLogsApi.GetSummaryAsync(from, to, top, ct);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/OperationalLogs")]
    public async Task<IActionResult> ConfigOperationalLogs(string tenantId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var tid = tenantId!.Trim().ToLowerInvariant();
        ViewData["OwnerConfigApiBase"] = Url.Action(nameof(ConfigOperationalLogs), "Owner", new { tenantId = tid });
        return View("~/Views/AdminOperationalLogs/Index.cshtml", new OperationalLogsPageViewModel("Logs Operacionais"));
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/OperationalLogs/_api/requests")]
    public async Task<IActionResult> ConfigOperationalLogsApiRequests(string tenantId, [FromQuery] OperationalLogsQuery query, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var response = await _operationalLogsApi.ListAsync(query, ct);
        return response is null ? Unauthorized() : Ok(response);
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/OperationalLogs/_api/requests/{id:guid}")]
    public async Task<IActionResult> ConfigOperationalLogsApiRequestById(string tenantId, Guid id, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var response = await _operationalLogsApi.GetByIdAsync(id, ct);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/OperationalLogs/_api/summary")]
    public async Task<IActionResult> ConfigOperationalLogsApiSummary(string tenantId, [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, [FromQuery] int top = 6, CancellationToken ct = default)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var response = await _operationalLogsApi.GetSummaryAsync(from, to, top, ct);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/EmailTemplates")]
    public async Task<IActionResult> ConfigEmailTemplates(string tenantId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var tid = tenantId!.Trim().ToLowerInvariant();
        ViewData["OwnerConfigApiBase"] = Url.Action(nameof(ConfigEmailTemplates), "Owner", new { tenantId = tid });
        return View("~/Views/AdminEmailTemplates/Index.cshtml");
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/EmailTemplates/_api/templates")]
    public async Task<IActionResult> ConfigEmailTemplatesApiList(string tenantId, [FromQuery] bool includeInactive = true, CancellationToken ct = default)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var list = await _emailTemplatesApi.ListAsync(includeInactive, ct);
        return Ok(list ?? Array.Empty<EmailTemplateListItemViewModel>());
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/EmailTemplates/_api/templates/{id:guid}")]
    public async Task<IActionResult> ConfigEmailTemplatesApiById(string tenantId, Guid id, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var item = await _emailTemplatesApi.GetAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Config/EmailTemplates/_api/templates")]
    public async Task<IActionResult> ConfigEmailTemplatesApiCreate(string tenantId, [FromBody] EmailTemplateCreateViewModel request, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var created = await _emailTemplatesApi.CreateAsync(request, ct);
        return created is null ? BadRequest() : Ok(created);
    }

    [HttpPut("/Owner/Tenants/{tenantId}/Config/EmailTemplates/_api/templates/{id:guid}")]
    public async Task<IActionResult> ConfigEmailTemplatesApiUpdate(string tenantId, Guid id, [FromBody] EmailTemplateUpdateViewModel request, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var updated = await _emailTemplatesApi.UpdateAsync(id, request, ct);
        return updated is null ? BadRequest() : Ok(updated);
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Config/EmailTemplates/_api/templates/{id:guid}/set-active")]
    public async Task<IActionResult> ConfigEmailTemplatesApiSetActive(string tenantId, Guid id, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var ok = await _emailTemplatesApi.SetActiveAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Emails")]
    public async Task<IActionResult> ConfigEmails(string tenantId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var tid = tenantId!.Trim().ToLowerInvariant();
        ViewData["OwnerConfigApiBase"] = Url.Action(nameof(ConfigEmails), "Owner", new { tenantId = tid });
        return View("~/Views/AdminEmails/Index.cshtml");
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Emails/_api/messages")]
    public async Task<IActionResult> ConfigEmailsApiMessages(string tenantId, [FromQuery] string? scope, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var response = await _emailMessagesApi.ListAsync(scope ?? "mine", page, pageSize, ct);
        return response is null ? Unauthorized() : Ok(response);
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Emails/_api/summary")]
    public async Task<IActionResult> ConfigEmailsApiSummary(string tenantId, [FromQuery] string? scope, CancellationToken ct = default)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var response = await _emailMessagesApi.GetSummaryAsync(scope ?? "mine", ct);
        return response is null ? Unauthorized() : Ok(response);
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Emails/_api/messages/{id:guid}")]
    public async Task<IActionResult> ConfigEmailsApiMessageById(string tenantId, Guid id, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var response = await _emailMessagesApi.GetAsync(id, ct);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Config/Emails/_api/messages/{id:guid}/retry")]
    public async Task<IActionResult> ConfigEmailsApiRetry(string tenantId, Guid id, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var ok = await _emailMessagesApi.RetryAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/EmailConfig")]
    public async Task<IActionResult> ConfigEmailConfig(string tenantId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var tid = tenantId!.Trim().ToLowerInvariant();
        ViewData["OwnerConfigApiBase"] = Url.Action(nameof(ConfigEmailConfig), "Owner", new { tenantId = tid });
        return View("~/Views/AdminEmailConfig/Index.cshtml");
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/EmailConfig/_api/config")]
    public async Task<IActionResult> ConfigEmailConfigApiGet(string tenantId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var config = await _emailConfigApi.GetAsync(ct);
        return config is null ? NotFound() : Ok(config);
    }

    [HttpPut("/Owner/Tenants/{tenantId}/Config/EmailConfig/_api/config")]
    public async Task<IActionResult> ConfigEmailConfigApiPut(string tenantId, [FromBody] EmailConfigRequest request, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var result = await _emailConfigApi.SaveAsync(request, ct);
        return result is null ? BadRequest() : Ok(result);
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Config/EmailConfig/_api/test-smtp")]
    public async Task<IActionResult> ConfigEmailConfigApiTestSmtp(string tenantId, [FromBody] EmailConfigTestRequest request, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var ok = await _emailConfigApi.TestSmtpAsync(request, ct);
        return ok ? NoContent() : BadRequest();
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Config/EmailConfig/_api/test-imap")]
    public async Task<IActionResult> ConfigEmailConfigApiTestImap(string tenantId, [FromBody] EmailConfigTestRequest request, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var ok = await _emailConfigApi.TestImapAsync(request, ct);
        return ok ? NoContent() : BadRequest();
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/EntraIdConfig")]
    public async Task<IActionResult> ConfigEntraIdConfig(string tenantId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var tid = tenantId!.Trim().ToLowerInvariant();
        ViewData["OwnerConfigApiBase"] = Url.Action(nameof(ConfigEntraIdConfig), "Owner", new { tenantId = tid });
        return View("~/Views/AdminEntraIdConfig/Index.cshtml");
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/EntraIdConfig/_api/config")]
    public async Task<IActionResult> ConfigEntraIdConfigApiGet(string tenantId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var config = await _entraIdConfigApi.GetAsync(ct);
        return config is null ? NotFound() : Ok(config);
    }

    [HttpPut("/Owner/Tenants/{tenantId}/Config/EntraIdConfig/_api/config")]
    public async Task<IActionResult> ConfigEntraIdConfigApiPut(string tenantId, [FromBody] EntraIdConfigRequest request, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var result = await _entraIdConfigApi.SaveAsync(request, ct);
        return result is null ? BadRequest() : Ok(result);
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/LocalizationConfig")]
    public async Task<IActionResult> ConfigLocalizationConfig(string tenantId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var tid = tenantId!.Trim().ToLowerInvariant();
        ViewData["OwnerConfigApiBase"] = Url.Action(nameof(ConfigLocalizationConfig), "Owner", new { tenantId = tid });
        return View("~/Views/AdminLocalizationConfig/Index.cshtml");
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/LocalizationConfig/_api/config")]
    public async Task<IActionResult> ConfigLocalizationConfigApiGet(string tenantId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var config = await _localizationConfigApi.GetAsync(ct);
        return config is null ? NotFound() : Ok(config);
    }

    [HttpPut("/Owner/Tenants/{tenantId}/Config/LocalizationConfig/_api/config")]
    public async Task<IActionResult> ConfigLocalizationConfigApiPut(string tenantId, [FromBody] LocalizationConfigRequest request, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return redirect;
        var result = await _localizationConfigApi.SaveAsync(request, ct);
        return result is null ? BadRequest() : Ok(result);
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Delete")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteTenant(string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            TempData["OwnerError"] = "TenantId inválido.";
            return RedirectToAction(nameof(Tenants));
        }
        var (success, error) = await _ownerTenantsApi.DeleteTenantAsync(tenantId, ct);
        if (success)
            TempData["OwnerSuccess"] = $"Tenant {tenantId} foi desativado. Os usuários não poderão mais acessá-lo.";
        else
            TempData["OwnerError"] = $"Erro ao eliminar tenant: {error}";
        return RedirectToAction(nameof(Tenants));
    }

    [HttpPost("/Owner/Tenants/{tenantId}/migrations/apply")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ApplyMigrations(string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            TempData["OwnerError"] = "TenantId inválido.";
            return RedirectToAction(nameof(Tenants));
        }
        var (success, appliedCount, error) = await _ownerTenantsApi.ApplyMigrationsAsync(tenantId, ct);
        if (success)
            TempData["OwnerSuccess"] = appliedCount > 0 ? $"Migrações aplicadas no tenant {tenantId}: {appliedCount} migração(ões)." : $"Tenant {tenantId} já estava em dia.";
        else
            TempData["OwnerError"] = $"Erro ao aplicar migrações em {tenantId}: {error}";
        return RedirectToAction(nameof(Tenants));
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Seed")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SeedTenant(string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            TempData["OwnerError"] = "TenantId inválido.";
            return RedirectToAction(nameof(Tenants));
        }
        var (success, error) = await _ownerTenantsApi.SeedTenantAsync(tenantId, ct);
        if (success)
            TempData["OwnerSuccess"] = $"Seed executado no tenant {tenantId}. Usuário admin: admin@dev.local (senha em Seed:AdminPassword no appsettings da API).";
        else
            TempData["OwnerError"] = $"Erro ao executar seed em {tenantId}: {error}";
        return RedirectToAction(nameof(TenantUsers), new { tenantId });
    }

    // ── _api JSON endpoints consumed by Next.js TenantsScreen ──

    [HttpGet("/Owner/Tenants/_api/list")]
    public async Task<IActionResult> TenantsApiList(CancellationToken ct)
    {
        var list = await _ownerTenantsApi.ListTenantsAsync(ct);
        if (list is null) return StatusCode(502, new { error = "Não foi possível carregar a lista de tenants." });

        IReadOnlyList<TenantMigrationStatusDto>? statusList = null;
        try { statusList = await _ownerTenantsApi.GetMigrationStatusAsync(ct); } catch { }
        var statusByTenant = statusList?.ToDictionary(s => s.TenantId, StringComparer.OrdinalIgnoreCase) ?? new Dictionary<string, TenantMigrationStatusDto>();

        var withStatus = list.Select(t =>
        {
            var st = statusByTenant.GetValueOrDefault(t.TenantId);
            return new TenantWithStatusDto(t.TenantId, t.Name, t.IsActive, t.CreatedAtUtc, t.UpdatedAtUtc, st?.IsUpToDate, st?.PendingCount ?? 0, st?.ErrorMessage);
        }).ToList();

        return Ok(withStatus);
    }

    [HttpGet("/Owner/Tenants/_api/detail/{tenantId}")]
    public async Task<IActionResult> TenantsApiDetail(string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId)) return BadRequest(new { error = "TenantId inválido." });
        var tenant = await _ownerTenantsApi.GetTenantAsync(tenantId, ct);
        if (tenant is null) return NotFound(new { error = "Tenant não encontrado." });

        TenantMigrationStatusDto? migrationStatus = null;
        try
        {
            var statusList = await _ownerTenantsApi.GetMigrationStatusAsync(ct);
            migrationStatus = statusList?.FirstOrDefault(s => string.Equals(s.TenantId, tenantId, StringComparison.OrdinalIgnoreCase));
        }
        catch { }

        return Ok(new { tenant, migrationStatus });
    }

    [HttpPost("/Owner/Tenants/_api/create")]
    public async Task<IActionResult> TenantsApiCreate([FromBody] TenantsApiCreateRequest request, CancellationToken ct)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.TenantId) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "TenantId e Nome são obrigatórios." });
        var (success, error) = await _ownerTenantsApi.CreateTenantAsync(request.TenantId, request.Name, ct);
        if (!success) return BadRequest(new { error = error ?? "Erro ao criar tenant." });
        return Ok(new { tenantId = request.TenantId.Trim().ToLowerInvariant() });
    }

    public record TenantsApiCreateRequest(string TenantId, string Name);

    [HttpPost("/Owner/Tenants/_api/delete/{tenantId}")]
    public async Task<IActionResult> TenantsApiDelete(string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId)) return BadRequest(new { error = "TenantId inválido." });
        var (success, error) = await _ownerTenantsApi.DeleteTenantAsync(tenantId, ct);
        if (!success) return BadRequest(new { error = error ?? "Erro ao eliminar tenant." });
        return Ok(new { message = $"Tenant {tenantId} desativado." });
    }

    [HttpPost("/Owner/Tenants/_api/migrations/apply/{tenantId}")]
    public async Task<IActionResult> TenantsApiApplyMigrations(string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId)) return BadRequest(new { error = "TenantId inválido." });
        var (success, appliedCount, error) = await _ownerTenantsApi.ApplyMigrationsAsync(tenantId, ct);
        if (!success) return BadRequest(new { error = error ?? "Erro ao aplicar migrações." });
        return Ok(new { message = appliedCount > 0 ? $"Migrações aplicadas: {appliedCount}" : "Tenant já estava em dia.", appliedCount });
    }

    [HttpPost("/Owner/Tenants/_api/seed/{tenantId}")]
    public async Task<IActionResult> TenantsApiSeed(string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId)) return BadRequest(new { error = "TenantId inválido." });
        var (success, error) = await _ownerTenantsApi.SeedTenantAsync(tenantId, ct);
        if (!success) return BadRequest(new { error = error ?? "Erro ao executar seed." });
        return Ok(new { message = $"Seed executado no tenant {tenantId}." });
    }

    // ── End _api JSON endpoints ──

    [HttpGet("/Owner/Tenants/Create")]
    public IActionResult CreateTenant()
    {
        return View("Tenants/Create");
    }

    [HttpPost("/Owner/Tenants/Create")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateTenant([FromForm] string tenantId, [FromForm] string name, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId) || string.IsNullOrWhiteSpace(name))
        {
            TempData["OwnerError"] = "TenantId e Nome são obrigatórios.";
            return View("Tenants/Create");
        }

        try
        {
            var (success, error) = await _ownerTenantsApi.CreateTenantAsync(tenantId, name, ct);
            if (!success)
            {
                TempData["OwnerError"] = !string.IsNullOrWhiteSpace(error) ? error : "Erro ao criar tenant. Verifique os logs da API.";
                return View("Tenants/Create");
            }
        }
        catch (Exception ex)
        {
            TempData["OwnerError"] = "Erro ao chamar a API: " + ex.Message;
            return View("Tenants/Create");
        }

        TempData["OwnerSuccess"] = $"Tenant {tenantId} criado com sucesso. Use \"Acessar o tenant\" abaixo para ver o dashboard do novo tenant (sem CVs até receber candidaturas).";
        TempData["CreatedTenantId"] = tenantId.Trim().ToLowerInvariant();
        return RedirectToAction(nameof(Tenants));
    }

    // ── _api JSON endpoints for TenantUsers consumed by Next.js ──

    [HttpGet("/Owner/Tenants/{tenantId}/Users/_api/list")]
    public async Task<IActionResult> TenantUsersApiList(string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId)) return BadRequest(new { error = "TenantId inválido." });
        var users = await _ownerTenantUsersApi.ListUsersAsync(tenantId, ct);
        return Ok(users ?? Array.Empty<UserListItemViewModel>());
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Users/_api/get/{id:guid}")]
    public async Task<IActionResult> TenantUsersApiGet(string tenantId, Guid id, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId)) return BadRequest(new { error = "TenantId inválido." });
        var user = await _ownerTenantUsersApi.GetUserAsync(tenantId, id, ct);
        return user is null ? NotFound(new { error = "Usuário não encontrado." }) : Ok(user);
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Users/_api/create")]
    public async Task<IActionResult> TenantUsersApiCreate(string tenantId, [FromBody] UserFormApiModel model, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId)) return BadRequest(new { error = "TenantId inválido." });
        if (string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.FullName) || string.IsNullOrWhiteSpace(model.Password))
            return BadRequest(new { error = "Email, Nome e Senha são obrigatórios." });
        var request = new UsersApiClient.UserCreateRequest(
            model.Email.Trim(), model.FullName.Trim(), model.Password,
            model.IsActive, model.RoleIds ?? new List<Guid>(),
            model.UnitIds?.Count > 0 ? model.UnitIds : null,
            model.FuncionarioId);
        var created = await _ownerTenantUsersApi.CreateUserAsync(tenantId, request, ct);
        return created is null ? BadRequest(new { error = "Não foi possível criar o usuário." }) : Ok(created);
    }

    [HttpPut("/Owner/Tenants/{tenantId}/Users/_api/update/{id:guid}")]
    public async Task<IActionResult> TenantUsersApiUpdate(string tenantId, Guid id, [FromBody] UserFormApiModel model, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId)) return BadRequest(new { error = "TenantId inválido." });
        var updateReq = new UsersApiClient.UserUpdateRequest(
            model.Email?.Trim() ?? "", model.FullName?.Trim() ?? "", model.IsActive,
            model.UnitIds?.Count > 0 ? model.UnitIds : null,
            model.FuncionarioId);
        var updated = await _ownerTenantUsersApi.UpdateUserAsync(tenantId, id, updateReq, ct);
        if (updated is null) return BadRequest(new { error = "Não foi possível atualizar o usuário." });
        await _ownerTenantUsersApi.UpdateUserRolesAsync(tenantId, id, model.RoleIds ?? new List<Guid>(), ct);
        return Ok(updated);
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Users/_api/delete/{id:guid}")]
    public async Task<IActionResult> TenantUsersApiDelete(string tenantId, Guid id, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId)) return BadRequest(new { error = "TenantId inválido." });
        var removed = await _ownerTenantUsersApi.DeleteUserAsync(tenantId, id, ct);
        return removed ? Ok(new { message = "Usuário removido." }) : BadRequest(new { error = "Não foi possível remover o usuário." });
    }

    [HttpPut("/Owner/Tenants/{tenantId}/Users/_api/password/{id:guid}")]
    public async Task<IActionResult> TenantUsersApiSetPassword(string tenantId, Guid id, [FromBody] SetPasswordApiModel model, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId)) return BadRequest(new { error = "TenantId inválido." });
        if (string.IsNullOrWhiteSpace(model.NewPassword) || model.NewPassword.Length < 8)
            return BadRequest(new { error = "A nova senha deve ter no mínimo 8 caracteres." });
        var updated = await _ownerTenantUsersApi.SetUserPasswordAsync(tenantId, id, model.NewPassword, ct);
        return updated is null ? BadRequest(new { error = "Não foi possível alterar a senha." }) : Ok(new { message = "Senha alterada." });
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Users/_api/roles")]
    public async Task<IActionResult> TenantUsersApiListRoles(string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId)) return BadRequest(new { error = "TenantId inválido." });
        var roles = await _ownerTenantUsersApi.ListRolesAsync(tenantId, ct);
        return Ok(roles);
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Users/_api/units")]
    public async Task<IActionResult> TenantUsersApiListUnits(string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId)) return BadRequest(new { error = "TenantId inválido." });
        var units = await _ownerTenantUsersApi.ListUnitsAsync(tenantId, 1, 500, ct);
        return Ok(units.Items);
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Users/_api/funcionarios")]
    public async Task<IActionResult> TenantUsersApiListFuncionarios(string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId)) return BadRequest(new { error = "TenantId inválido." });
        var funcionarios = await _ownerTenantUsersApi.ListFuncionariosAsync(tenantId, 1, 500, ct);
        return Ok(funcionarios.Items);
    }

    public record UserFormApiModel(string? Email, string? FullName, string? Password, bool IsActive, List<Guid>? RoleIds, List<Guid>? UnitIds, Guid? FuncionarioId);
    public record SetPasswordApiModel(string NewPassword);

    // ── _api JSON endpoints for Accesses consumed by Next.js ──

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Acessos/_api/roles")]
    public async Task<IActionResult> ConfigAcessosApiRoles(string tenantId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return Unauthorized();
        var roles = await _rolesApi.ListAsync(ct);
        return Ok(roles);
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Acessos/_api/menus")]
    public async Task<IActionResult> ConfigAcessosApiMenus(string tenantId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return Unauthorized();
        var menus = await _menusApi.ListAsync(ct);
        return Ok(menus);
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Acessos/_api/role-menus/{roleId:guid}")]
    public async Task<IActionResult> ConfigAcessosApiRoleMenus(string tenantId, Guid roleId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return Unauthorized();
        var assignments = await _rolesApi.GetRoleMenusAsync(roleId, ct);
        return Ok(assignments);
    }

    [HttpPut("/Owner/Tenants/{tenantId}/Config/Acessos/_api/role-menus/{roleId:guid}")]
    public async Task<IActionResult> ConfigAcessosApiUpdateRoleMenus(string tenantId, Guid roleId, [FromBody] AcessosUpdateApiModel model, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return Unauthorized();
        var menus = await _menusApi.ListAsync(ct);
        var menuByPermission = menus.ToDictionary(x => x.PermissionKey, x => x);
        var items = new List<RoleMenuAssignmentViewModel>();
        foreach (var permission in (model.SelectedPermissions ?? Array.Empty<string>()).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (menuByPermission.TryGetValue(permission, out var menu))
            {
                items.Add(new RoleMenuAssignmentViewModel(menu.Id, permission));
                continue;
            }
            if (string.Equals(permission, "users.write", StringComparison.OrdinalIgnoreCase) && menuByPermission.TryGetValue("users.read", out var usersMenu))
                items.Add(new RoleMenuAssignmentViewModel(usersMenu.Id, "users.write"));
        }
        await _rolesApi.UpdateRoleMenusAsync(roleId, new RolesApiClient.RoleMenusUpdateRequest(items), ct);
        return Ok(new { message = "Acessos atualizados." });
    }

    public record AcessosUpdateApiModel(string[]? SelectedPermissions);

    // ── _api JSON endpoints for Menus consumed by Next.js ──

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Menus/_api/list")]
    public async Task<IActionResult> ConfigMenusApiList(string tenantId, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return Unauthorized();
        var menus = await _menusApi.ListAsync(ct);
        return Ok(menus);
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Config/Menus/_api/get/{id:guid}")]
    public async Task<IActionResult> ConfigMenusApiGet(string tenantId, Guid id, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return Unauthorized();
        var menu = await _menusApi.GetByIdAsync(id, ct);
        return menu is null ? NotFound() : Ok(menu);
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Config/Menus/_api/create")]
    public async Task<IActionResult> ConfigMenusApiCreate(string tenantId, [FromBody] MenuFormApiModel model, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return Unauthorized();
        var request = new MenusApiClient.MenuCreateRequest(model.DisplayName?.Trim() ?? "", model.Route?.Trim() ?? "", model.Icon?.Trim() ?? "", model.Order, model.ParentId, model.PermissionKey?.Trim() ?? "", model.IsActive);
        var created = await _menusApi.CreateAsync(request, ct);
        return created is null ? BadRequest(new { error = "Não foi possível criar o menu." }) : Ok(created);
    }

    [HttpPut("/Owner/Tenants/{tenantId}/Config/Menus/_api/update/{id:guid}")]
    public async Task<IActionResult> ConfigMenusApiUpdate(string tenantId, Guid id, [FromBody] MenuFormApiModel model, CancellationToken ct)
    {
        var redirect = await EnsureOwnerConfigTenantAsync(tenantId, ct);
        if (redirect is not null) return Unauthorized();
        var request = new MenusApiClient.MenuUpdateRequest(model.DisplayName?.Trim() ?? "", model.Route?.Trim() ?? "", model.Icon?.Trim() ?? "", model.Order, model.ParentId, model.PermissionKey?.Trim() ?? "", model.IsActive);
        var updated = await _menusApi.UpdateAsync(id, request, ct);
        return updated is null ? BadRequest(new { error = "Não foi possível atualizar o menu." }) : Ok(updated);
    }

    public record MenuFormApiModel(string? DisplayName, string? Route, string? Icon, int Order, Guid? ParentId, string? PermissionKey, bool IsActive);

    // ── End additional _api endpoints ──

    [HttpGet("/Owner/Tenants/{tenantId}/Users")]
    public async Task<IActionResult> TenantUsers(string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            TempData["OwnerError"] = "TenantId inválido.";
            return RedirectToAction(nameof(Tenants));
        }
        var users = await _ownerTenantUsersApi.ListUsersAsync(tenantId, ct);
        if (users is null)
        {
            TempData["OwnerError"] = "Não foi possível carregar os usuários. Verifique se está logado como Owner (tenant = owner) e se a API está acessível.";
            users = Array.Empty<UserListItemViewModel>();
        }
        var roles = await _ownerTenantUsersApi.ListRolesAsync(tenantId, ct);
        ViewData["TenantId"] = tenantId;
        return View("TenantUsers/Index", new UsersPageViewModel { Users = users, Roles = roles ?? Array.Empty<RoleListItemViewModel>() });
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Users/New")]
    public async Task<IActionResult> NewTenantUser(string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            TempData["OwnerError"] = "TenantId inválido.";
            return RedirectToAction(nameof(Tenants));
        }
        var (roles, units, funcionarios) = await LoadTenantRolesUnitsFuncionariosAsync(tenantId, ct);
        ViewData["TenantId"] = tenantId;
        return View("TenantUsers/Edit", new UserEditViewModel
        {
            IsNew = true,
            Roles = roles,
            Units = units,
            Funcionarios = funcionarios
        });
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Users/New")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateTenantUser(string tenantId, [FromForm] UserFormModel model, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            TempData["OwnerError"] = "TenantId inválido.";
            return RedirectToAction(nameof(Tenants));
        }
        if (!ModelState.IsValid || string.IsNullOrWhiteSpace(model.Password))
        {
            var (roles, units, funcionarios) = await LoadTenantRolesUnitsFuncionariosAsync(tenantId, ct);
            if (string.IsNullOrWhiteSpace(model.Password))
                ModelState.AddModelError(nameof(model.Password), "Senha é obrigatória.");
            ViewData["TenantId"] = tenantId;
            return View("TenantUsers/Edit", new UserEditViewModel
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
            model.RoleIds ?? new List<Guid>(),
            model.UnitIds?.Count > 0 ? model.UnitIds : null,
            model.FuncionarioId
        );
        var created = await _ownerTenantUsersApi.CreateUserAsync(tenantId, request, ct);
        if (created is null)
        {
            var (roles, units, funcionarios) = await LoadTenantRolesUnitsFuncionariosAsync(tenantId, ct);
            ModelState.AddModelError(string.Empty, "Não foi possível criar o usuário.");
            ViewData["TenantId"] = tenantId;
            return View("TenantUsers/Edit", new UserEditViewModel
            {
                IsNew = true,
                User = model,
                Roles = roles,
                Units = units,
                Funcionarios = funcionarios
            });
        }
        TempData["OwnerSuccess"] = "Usuário criado com sucesso.";
        return RedirectToAction(nameof(TenantUsers), new { tenantId });
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Users/Edit/{id:guid}")]
    public async Task<IActionResult> EditTenantUser(string tenantId, Guid id, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            TempData["OwnerError"] = "TenantId inválido.";
            return RedirectToAction(nameof(Tenants));
        }
        var user = await _ownerTenantUsersApi.GetUserAsync(tenantId, id, ct);
        if (user is null)
        {
            TempData["OwnerError"] = "Usuário não encontrado.";
            return RedirectToAction(nameof(TenantUsers), new { tenantId });
        }
        var (roles, units, funcionarios) = await LoadTenantRolesUnitsFuncionariosAsync(tenantId, ct);
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
        ViewData["TenantId"] = tenantId;
        return View("TenantUsers/Edit", new UserEditViewModel
        {
            IsNew = false,
            User = form,
            Roles = roles,
            Units = units,
            Funcionarios = funcionarios
        });
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Users/Edit/{id:guid}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateTenantUser(string tenantId, Guid id, [FromForm] UserFormModel model, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            TempData["OwnerError"] = "TenantId inválido.";
            return RedirectToAction(nameof(Tenants));
        }
        if (!ModelState.IsValid)
        {
            var (roles, units, funcionarios) = await LoadTenantRolesUnitsFuncionariosAsync(tenantId, ct);
            ViewData["TenantId"] = tenantId;
            return View("TenantUsers/Edit", new UserEditViewModel
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
        var updated = await _ownerTenantUsersApi.UpdateUserAsync(tenantId, id, updateRequest, ct);
        if (updated is null)
        {
            var (roles, units, funcionarios) = await LoadTenantRolesUnitsFuncionariosAsync(tenantId, ct);
            ModelState.AddModelError(string.Empty, "Não foi possível atualizar o usuário.");
            ViewData["TenantId"] = tenantId;
            return View("TenantUsers/Edit", new UserEditViewModel
            {
                IsNew = false,
                User = model,
                Roles = roles,
                Units = units,
                Funcionarios = funcionarios
            });
        }
        await _ownerTenantUsersApi.UpdateUserRolesAsync(tenantId, id, model.RoleIds ?? new List<Guid>(), ct);
        TempData["OwnerSuccess"] = "Usuário atualizado com sucesso.";
        return RedirectToAction(nameof(TenantUsers), new { tenantId });
    }

    [HttpGet("/Owner/Tenants/{tenantId}/Users/Password/{id:guid}")]
    public IActionResult SetTenantUserPassword(string tenantId, Guid id)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            TempData["OwnerError"] = "TenantId inválido.";
            return RedirectToAction(nameof(Tenants));
        }
        ViewData["TenantId"] = tenantId;
        ViewData["UserId"] = id;
        return View("TenantUsers/SetPassword");
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Users/Password/{id:guid}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SetTenantUserPassword(string tenantId, Guid id, [FromForm] string newPassword, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            TempData["OwnerError"] = "TenantId inválido.";
            return RedirectToAction(nameof(Tenants));
        }
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 8)
        {
            TempData["OwnerError"] = "A nova senha deve ter no mínimo 8 caracteres.";
            ViewData["TenantId"] = tenantId;
            ViewData["UserId"] = id;
            return View("TenantUsers/SetPassword");
        }
        var updated = await _ownerTenantUsersApi.SetUserPasswordAsync(tenantId, id, newPassword, ct);
        if (updated is null)
        {
            TempData["OwnerError"] = "Não foi possível alterar a senha.";
            ViewData["TenantId"] = tenantId;
            ViewData["UserId"] = id;
            return View("TenantUsers/SetPassword");
        }
        TempData["OwnerSuccess"] = "Senha alterada com sucesso.";
        return RedirectToAction(nameof(TenantUsers), new { tenantId });
    }

    [HttpPost("/Owner/Tenants/{tenantId}/Users/Delete/{id:guid}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteTenantUser(string tenantId, Guid id, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            TempData["OwnerError"] = "TenantId inválido.";
            return RedirectToAction(nameof(Tenants));
        }
        var removed = await _ownerTenantUsersApi.DeleteUserAsync(tenantId, id, ct);
        if (removed)
            TempData["OwnerSuccess"] = "Usuário removido.";
        else
            TempData["OwnerError"] = "Não foi possível remover o usuário.";
        return RedirectToAction(nameof(TenantUsers), new { tenantId });
    }

    private async Task<(IReadOnlyList<RoleListItemViewModel> Roles, IReadOnlyList<UnitInfoViewModel> Units, IReadOnlyList<FuncionarioInfoViewModel> Funcionarios)> LoadTenantRolesUnitsFuncionariosAsync(string tenantId, CancellationToken ct)
    {
        var rolesTask = _ownerTenantUsersApi.ListRolesAsync(tenantId, ct);
        var unitsTask = _ownerTenantUsersApi.ListUnitsAsync(tenantId, 1, 500, ct);
        var funcionariosTask = _ownerTenantUsersApi.ListFuncionariosAsync(tenantId, 1, 500, ct);
        await Task.WhenAll(rolesTask, unitsTask, funcionariosTask);
        var roles = await rolesTask;
        var unitsResp = await unitsTask;
        var funcionariosResp = await funcionariosTask;
        return (roles, unitsResp.Items, funcionariosResp.Items);
    }
}
