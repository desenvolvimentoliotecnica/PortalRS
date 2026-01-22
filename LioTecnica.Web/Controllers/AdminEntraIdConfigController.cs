using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.Services;
using LioTecnica.Web.ViewModels.Admin;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

[RequirePermission("entra-config.manage")]
public sealed class AdminEntraIdConfigController : Controller
{
    private readonly EntraIdConfigApiClient _api;
    private readonly IEntraIdLocalConfigStore _localStore;

    public AdminEntraIdConfigController(
        EntraIdConfigApiClient api,
        IEntraIdLocalConfigStore localStore)
    {
        _api = api;
        _localStore = localStore;
    }

    [HttpGet("/Admin/EntraIdConfig")]
    public IActionResult Index()
    {
        return View();
    }

    [HttpGet("/Admin/EntraIdConfig/_api/config")]
    public async Task<ActionResult<EntraIdConfigViewModel>> Get(CancellationToken ct)
    {
        var data = await _api.GetAsync(ct);
        if (data is not null)
            return Ok(data);

        var local = await _localStore.GetAsync(ct);
        return local is null ? NotFound() : Ok(local);
    }

    [HttpPut("/Admin/EntraIdConfig/_api/config")]
    public async Task<ActionResult<EntraIdConfigViewModel>> Save(
        [FromBody] EntraIdConfigRequest request,
        CancellationToken ct)
    {
        var data = await _api.SaveAsync(request, ct);
        if (data is null)
            return BadRequest();
        await _localStore.SaveAsync(request, ct);
        return Ok(data);
    }
}
