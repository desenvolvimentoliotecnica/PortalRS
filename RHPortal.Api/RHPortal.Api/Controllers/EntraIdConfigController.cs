using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Authentication;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Configuração do Entra ID (Azure AD) do tenant.
/// </summary>
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

    /// <summary>
    /// Obtém a configuração atual do Entra ID.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(EntraIdConfigView), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EntraIdConfigView>> Get(CancellationToken ct)
    {
        var data = await _service.GetAsync(ct);
        if (data is null)
            return NotFound();
        return Ok(data);
    }

    /// <summary>
    /// Salva/atualiza a configuração do Entra ID.
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(EntraIdConfigView), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<EntraIdConfigView>> Save([FromBody] EntraIdConfigDto dto, CancellationToken ct)
    {
        try
        {
            var data = await _service.SaveAsync(dto, ct);
            return Ok(data);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ProblemDetails { Title = "Configuração inválida", Detail = ex.Message, Status = 400 });
        }
    }
}
