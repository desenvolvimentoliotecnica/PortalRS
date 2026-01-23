using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels.Admin;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

[RequirePermission("localization-config.manage")]
public sealed class AdminLocalizationConfigController : Controller
{
    private readonly LocalizationConfigApiClient _api;

    public AdminLocalizationConfigController(LocalizationConfigApiClient api)
    {
        _api = api;
    }

    [HttpGet("/Admin/LocalizationConfig")]
    public IActionResult Index()
    {
        return View();
    }

    [HttpGet("/Admin/LocalizationConfig/_api/config")]
    public async Task<ActionResult<LocalizationConfigViewModel>> Get(CancellationToken ct)
    {
        var data = await _api.GetAsync(ct);
        if (data is not null)
            return Ok(data);

        return Ok(new LocalizationConfigViewModel
        {
            Culture = "pt-BR",
            UiCulture = "pt-BR"
        });
    }

    [HttpPut("/Admin/LocalizationConfig/_api/config")]
    public async Task<ActionResult<LocalizationConfigViewModel>> Save(
        [FromBody] LocalizationConfigRequest request,
        CancellationToken ct)
    {
        var data = await _api.SaveAsync(request, ct);
        if (data is null)
            return BadRequest();
        return Ok(data);
    }
}
