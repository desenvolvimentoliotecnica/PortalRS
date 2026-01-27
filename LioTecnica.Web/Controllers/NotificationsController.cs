using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public class NotificationsController : Controller
{
    private readonly NotificationsApiClient _notificationsApi;
    private readonly PortalTenantContext _tenantContext;

    public NotificationsController(NotificationsApiClient notificationsApi, PortalTenantContext tenantContext)
    {
        _notificationsApi = notificationsApi;
        _tenantContext = tenantContext;
    }

    [HttpGet("/Notificacoes")]
    public IActionResult Index()
    {
        ViewData["Title"] = "Notificacoes";
        ViewData["SidebarSubtitle"] = "Caixa de entrada";
        return View();
    }

    [HttpGet("/Notifications/_api/list")]
    public async Task<IActionResult> List([FromQuery] int take = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var query = $"?take={take}";
        var resp = await _notificationsApi.GetNotificationsRawAsync(tenantId, query, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/Notifications/_api/send")]
    public async Task<IActionResult> Send(CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var payload = new
        {
            scope = "Tenant",
            title = "Notificacao de teste",
            message = "Esta é uma notificacao padrao do sistema.",
            level = "info",
            url = "/Notificacoes"
        };

        var json = System.Text.Json.JsonSerializer.Serialize(payload);
        var resp = await _notificationsApi.SendNotificationRawAsync(tenantId, json, ct);
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
