using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using RhPortal.Api.Application.TenantOperationalReset;
using RhPortal.Api.Contracts.TenantOperationalReset;
using RhPortal.Api.Infrastructure.Ops;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/tenant-operational-reset")]
[Authorize]
public sealed class TenantOperationalResetController : ControllerBase
{
    private readonly ITenantOperationalResetService _service;
    private readonly ICurrentUserContext _userContext;
    private readonly IHostEnvironment _env;
    private readonly ILogger<TenantOperationalResetController> _logger;

    public TenantOperationalResetController(
        ITenantOperationalResetService service,
        ICurrentUserContext userContext,
        IHostEnvironment env,
        ILogger<TenantOperationalResetController> logger)
    {
        _service = service;
        _userContext = userContext;
        _env = env;
        _logger = logger;
    }

    [HttpGet("preview")]
    [ProducesResponseType(typeof(OperationalResetPreviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<OperationalResetPreviewResponse>> Preview(CancellationToken ct)
    {
        var denied = DenyIfNotAllowed();
        if (denied is not null) return denied;

        return Ok(await _service.GetPreviewAsync(ct));
    }

    [HttpPost("execute")]
    [ProducesResponseType(typeof(OperationalResetExecuteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<OperationalResetExecuteResponse>> Execute(
        [FromBody] OperationalResetExecuteRequest? body,
        [FromServices] IHubContext<ResetProgressHub> hub,
        CancellationToken ct)
    {
        var denied = DenyIfNotAllowed();
        if (denied is not null) return denied;

        IResetProgressReporter? reporter = null;
        if (!string.IsNullOrWhiteSpace(body?.ConnectionId))
            reporter = new SignalRResetProgressReporter(hub, body.ConnectionId);

        _logger.LogWarning(
            "OPERATIONAL RESET requested by UserId={UserId} Email={Email}",
            _userContext.UserId,
            _userContext.Email);

        try
        {
            var result = await _service.ExecuteAsync(reporter, CancellationToken.None);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OPERATIONAL RESET failed for tenant.");
            return StatusCode(500, new OperationalResetExecuteResponse(
                Ok: false,
                Message: ex.Message,
                Removed: new OperationalResetCountsDto(0, 0, 0, 0, 0, 0, 0, 0, 0)));
        }
    }

    private ActionResult? DenyIfNotAllowed()
    {
        if (!OperationalResetEnvironment.IsAllowed(_env))
            return NotFound(new { error = "Reset operacional não disponível neste ambiente." });

        if (!_userContext.IsOwner)
            return Forbid();

        return null;
    }
}
