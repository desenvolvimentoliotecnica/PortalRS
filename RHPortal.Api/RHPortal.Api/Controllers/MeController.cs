using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Me;
using RhPortal.Api.Contracts.Authentication;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/me")]
[Authorize]
public sealed class MeController : ControllerBase
{
    private readonly MeService _meService;

    public MeController(MeService meService)
    {
        _meService = meService;
    }

    /// <summary>
    /// Returns the current user profile (roles, permissions, FuncionarioId, AreaId when applicable).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(CurrentUserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CurrentUserResponse>> Get(CancellationToken ct)
    {
        var response = await _meService.GetCurrentUserAsync(User, ct);
        if (response is null)
            return Unauthorized();
        return Ok(response);
    }

    /// <summary>
    /// Returns the list of tenants the current user is allowed to access.
    /// Owner: all active tenants; normal user: current tenant only.
    /// </summary>
    [HttpGet("tenants")]
    [ProducesResponseType(typeof(AllowedTenantsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AllowedTenantsResponse>> GetAllowedTenants(CancellationToken ct)
    {
        var response = await _meService.GetAllowedTenantsAsync(User, ct);
        return Ok(response);
    }

    /// <summary>
    /// Switches the active tenant and returns a new JWT with the updated tenant claim.
    /// Only tenants returned by GET /api/me/tenants are allowed.
    /// </summary>
    [HttpPost("switch-tenant")]
    [ProducesResponseType(typeof(SwitchTenantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<SwitchTenantResponse>> SwitchTenant(
        [FromBody] SwitchTenantRequest request,
        CancellationToken ct)
    {
        var response = await _meService.SwitchTenantAsync(User, request.TenantId.Trim(), ct);
        if (response is null)
        {
            return Forbid();
        }
        return Ok(response);
    }
}
