using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

[ApiController]
[Route("bff")]
public sealed class BffController : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("me")]
    public IActionResult Me()
    {
        if (User?.Identity?.IsAuthenticated != true)
            return Unauthorized();

        var tenantId = User.FindFirst("tenant")?.Value?.Trim() ?? string.Empty;
        var email = User.FindFirst(ClaimTypes.Email)?.Value?.Trim() ?? string.Empty;
        var displayName =
            User.Identity?.Name?.Trim()
            ?? User.FindFirst(ClaimTypes.Name)?.Value?.Trim()
            ?? email;

        var roles = User.FindAll(ClaimTypes.Role)
            .Select(x => x.Value)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var isInTenantContext =
            !string.IsNullOrWhiteSpace(tenantId)
            && !string.Equals(tenantId, "owner", StringComparison.OrdinalIgnoreCase);

        var hasOwnerCookie = !string.IsNullOrWhiteSpace(HttpContext.Request.Cookies["OwnerAccessToken"]);
        var isOwnerContext = (User.IsInRole("Owner") || hasOwnerCookie) && !isInTenantContext;

        return Ok(new
        {
            isAuthenticated = true,
            tenantId,
            displayName,
            email,
            roles,
            isAdmin = User.IsInRole("Admin"),
            isOwnerContext
        });
    }

    [AllowAnonymous]
    [HttpGet("config")]
    public IActionResult Config()
    {
        return Ok(new
        {
            legacy = new
            {
                loginUrl = "/Account/Login"
            }
        });
    }
}

