using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Authentication;
using RhPortal.Api.Application.Users;
using RhPortal.Api.Contracts.Authentication;
using RhPortal.Api.Contracts.Users;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
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
                Title = "Invalid credentials.",
                Detail = "Email or password is not valid.",
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
                Title = "Invalid Entra ID login.",
                Detail = "Entra ID token is not valid or user is not enabled.",
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
                Title = "Unable to create user.",
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
                Title = "Invalid token.",
                Detail = "User identifier is missing.",
                Status = StatusCodes.Status401Unauthorized
            });
        }

        var response = await service.GetCurrentUserAsync(userId, ct);
        return response is null ? NotFound() : Ok(response);
    }
}
