using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Portal;
using RhPortal.Api.Contracts.Portal;

namespace RhPortal.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/public/portal-auth")]
public sealed class PortalAuthController : ControllerBase
{
    [HttpPost("login")]
    public async Task<ActionResult<PortalCandidateAuthResponse>> Login(
        [FromBody] PortalCandidateLoginRequest request,
        [FromServices] IPortalCandidateAuthService service,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var response = await service.LoginAsync(request, ct);
        if (response is null)
            return Unauthorized(new { message = "Credenciais invalidas ou acesso nao configurado." });

        return Ok(response);
    }

    [HttpPost("register")]
    public async Task<ActionResult<PortalCandidateAuthResponse>> Register(
        [FromBody] PortalCandidateRegisterRequest request,
        [FromServices] IPortalCandidateAuthService service,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        try
        {
            var response = await service.RegisterAsync(request, ct);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}
