using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Localization;

namespace RhPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/localization-config")]
public sealed class LocalizationConfigController : ControllerBase
{
    private readonly ILocalizationConfigService _service;

    public LocalizationConfigController(ILocalizationConfigService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<LocalizationConfigView>> Get(CancellationToken ct)
    {
        var data = await _service.GetAsync(ct);
        if (data is null)
            return NotFound();
        return Ok(data);
    }

    [HttpPut]
    public async Task<ActionResult<LocalizationConfigView>> Save([FromBody] LocalizationConfigDto dto, CancellationToken ct)
    {
        var data = await _service.SaveAsync(dto, ct);
        return Ok(data);
    }
}
