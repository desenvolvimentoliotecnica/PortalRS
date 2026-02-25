using System.Net;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

[ApiController]
[Route("bff/notifications")]
public sealed class BffNotificationsController : ControllerBase
{
    private readonly NotificationsApiClient _notificationsApi;
    private readonly PortalTenantContext _tenantContext;

    public BffNotificationsController(NotificationsApiClient notificationsApi, PortalTenantContext tenantContext)
    {
        _notificationsApi = notificationsApi;
        _tenantContext = tenantContext;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int take = 20, CancellationToken ct = default)
    {
        if (User?.Identity?.IsAuthenticated != true)
            return Unauthorized();

        var tenantId = _tenantContext.TenantId;
        var query = $"?take={take}";

        ApiRawResponse resp;
        try
        {
            resp = await _notificationsApi.GetNotificationsRawAsync(tenantId, query, ct);
        }
        catch (HttpRequestException)
        {
            return Content("[]", "application/json");
        }
        catch (TaskCanceledException)
        {
            return Content("[]", "application/json");
        }

        return ToContentResult(resp);
    }

    private static IActionResult ToContentResult(ApiRawResponse resp)
    {
        if (string.IsNullOrWhiteSpace(resp.Content))
            return new StatusCodeResult((int)resp.StatusCode);

        return new ContentResult
        {
            StatusCode = (int)resp.StatusCode,
            ContentType = "application/json",
            Content = resp.Content
        };
    }
}

