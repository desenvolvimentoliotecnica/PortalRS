using LiotecnicaHub.Web.Application.Access;
using LiotecnicaHub.Web.Application.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LiotecnicaHub.Web.Controllers;

[ApiController]
[Route("api/hub")]
[Authorize]
public sealed class HubApiController : ControllerBase
{
    private readonly IHubAccessService _access;

    public HubApiController(IHubAccessService access) => _access = access;

    [HttpGet("meus-sistemas")]
    public async Task<IActionResult> GetMeusSistemas(CancellationToken ct)
    {
        var email = User.FindFirst(HubClaimTypes.Email)?.Value?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized();

        var sistemas = await _access.GetMeusSistemasAsync(email, ct);
        return Ok(sistemas);
    }
}
