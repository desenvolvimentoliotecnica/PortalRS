using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Authentication;

namespace RhPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/entra-config")]
public sealed class EntraIdConfigController : ControllerBase
{
    private readonly IEntraIdConfigService _service;

    public EntraIdConfigController(IEntraIdConfigService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<EntraIdConfigView>> Get(CancellationToken ct)
    {
        var data = await _service.GetAsync(ct);
        if (data is null)
            return NotFound();
        return Ok(data);
    }

    [HttpPut]
    public async Task<ActionResult<EntraIdConfigView>> Save([FromBody] EntraIdConfigDto dto, CancellationToken ct)
    {
        var data = await _service.SaveAsync(dto, ct);
        return Ok(data);
    }
}
