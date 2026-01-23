using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Portal;
using RhPortal.Api.Contracts.Portal;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/public/portal-auth")]
public sealed class PortalAuthController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public PortalAuthController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

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
            return Unauthorized(new { message = _localizer["ControllerErrors.PortalInvalidCredentials"] });

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
