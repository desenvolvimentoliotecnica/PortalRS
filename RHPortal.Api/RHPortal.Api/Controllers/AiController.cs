using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Ai;
using RhPortal.Api.Contracts.Ai;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize]
public sealed class AiController : ControllerBase
{
    private readonly IUnifiedAiService _service;
    private readonly ITenantContext _tenantContext;

    public AiController(IUnifiedAiService service, ITenantContext tenantContext)
    {
        _service = service;
        _tenantContext = tenantContext;
    }

    [HttpPost("invoke")]
    [ProducesResponseType(typeof(AiInvokeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AiInvokeResponse>> Invoke([FromBody] AiInvokeRequest request, CancellationToken ct)
    {
        if (request is null) return BadRequest();

        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId) || string.Equals(tenantId, "owner", StringComparison.OrdinalIgnoreCase))
            return Unauthorized();

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var userId = Guid.TryParse(userIdClaim, out var uid) ? uid : (Guid?)null;
        var userName = User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name;

        var result = await _service.InvokeAsync(tenantId, userId, userName, request, ct);
        if (result is null) return NotFound();
        return Ok(result);
    }
}
