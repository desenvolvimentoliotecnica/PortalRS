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
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<AiInvokeResponse>> Invoke([FromBody] AiInvokeRequest request, CancellationToken ct)
    {
        if (request is null) return BadRequest();

        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId) || string.Equals(tenantId, "owner", StringComparison.OrdinalIgnoreCase))
            return Unauthorized();

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var userId = Guid.TryParse(userIdClaim, out var uid) ? uid : (Guid?)null;
        var userName = User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name;

        // Fase 5 / LUC-117: distinguir motivo da indisponibilidade.
        var outcome = await _service.InvokeWithOutcomeAsync(tenantId, userId, userName, request, ct);
        if (outcome.Response is not null) return Ok(outcome.Response);

        // Mapear motivo → HTTP semanticamente correto (503 Service Unavailable).
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status503ServiceUnavailable,
            Title = outcome.Reason switch
            {
                AiUnavailableReason.ModuleDisabled => "IA desabilitada para este tenant",
                AiUnavailableReason.NoProviderConfigured => "Nenhum provider de IA configurado",
                AiUnavailableReason.ProviderResolutionFailed => "Provider de IA não reconhecido",
                _ => "Serviço de IA indisponível"
            },
            Detail = outcome.Detail,
            Type = "https://docs.renderrh.qualiit/ai/unavailable",
            Extensions =
            {
                ["reason"] = outcome.Reason?.ToString(),
                ["tenantId"] = tenantId,
            }
        };
        return StatusCode(StatusCodes.Status503ServiceUnavailable, problem);
    }
}
