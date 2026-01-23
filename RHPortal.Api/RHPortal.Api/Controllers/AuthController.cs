using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Authentication;
using RhPortal.Api.Application.Users;
using RhPortal.Api.Contracts.Authentication;
using RhPortal.Api.Contracts.Users;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public AuthController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(
        [FromBody] LoginRequest request,
        [FromServices] AuthenticationService service,
        CancellationToken ct)
    {
        var response = await service.LoginAsync(request, ct);
        if (response is null)
        {
            return Unauthorized(new ProblemDetails
            {
                Title = _localizer["ControllerErrors.InvalidCredentialsTitle"],
                Detail = _localizer["ControllerErrors.InvalidCredentialsDetail"],
                Status = StatusCodes.Status401Unauthorized
            });
        }

        return Ok(response);
    }

    [AllowAnonymous]
    [HttpPost("entra-login")]
    public async Task<ActionResult<LoginResponse>> EntraLogin(
        [FromBody] EntraLoginRequest request,
        [FromServices] AuthenticationService service,
        CancellationToken ct)
    {
        var response = await service.LoginWithEntraAsync(request, ct);
        if (response is null)
        {
            return Unauthorized(new ProblemDetails
            {
                Title = _localizer["ControllerErrors.InvalidEntraLoginTitle"],
                Detail = _localizer["ControllerErrors.InvalidEntraLoginDetail"],
                Status = StatusCodes.Status401Unauthorized
            });
        }

        return Ok(response);
    }

    [RequirePermission("users.write")]
    [HttpPost("register")]
    public async Task<ActionResult<UserResponse>> Register(
        [FromBody] UserCreateRequest request,
        [FromServices] UserAdministrationService service,
        CancellationToken ct)
    {
        try
        {
            var created = await service.CreateAsync(request, ct);
            return Ok(created);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ProblemDetails
            {
                Title = _localizer["ControllerErrors.UnableToCreateUserTitle"],
                Detail = ex.Message,
                Status = StatusCodes.Status409Conflict
            });
        }
    }

    [HttpGet("me")]
    public async Task<ActionResult<CurrentUserResponse>> Me(
        [FromServices] AuthenticationService service,
        CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new ProblemDetails
            {
                Title = _localizer["ControllerErrors.InvalidTokenTitle"],
                Detail = _localizer["ControllerErrors.InvalidTokenDetail"],
                Status = StatusCodes.Status401Unauthorized
            });
        }

        var response = await service.GetCurrentUserAsync(userId, ct);
        return response is null ? NotFound() : Ok(response);
    }
}
