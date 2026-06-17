using LiotecnicaHub.Web.Application.Authentication;
using LiotecnicaHub.Web.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LiotecnicaHub.Web.Controllers;

[ApiController]
[Route("api/hub/access")]
[Authorize]
public sealed class HubAccessProbeController : ControllerBase
{
    [HttpGet("probe")]
    [AuthorizeHubPermission("hub.auditoria.visualizar")]
    public IActionResult Probe() =>
        Ok(new { message = "Permissão hub.auditoria.visualizar concedida." });
}
