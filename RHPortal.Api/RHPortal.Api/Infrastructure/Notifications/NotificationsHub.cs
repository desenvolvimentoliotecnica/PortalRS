using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Infrastructure.Notifications;

[Authorize]
public sealed class NotificationsHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var tenantId = ResolveTenantId(Context);
        if (!string.IsNullOrWhiteSpace(tenantId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, GetTenantGroup(tenantId));
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var tenantId = ResolveTenantId(Context);
        if (!string.IsNullOrWhiteSpace(tenantId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, GetTenantGroup(tenantId));
        }

        await base.OnDisconnectedAsync(exception);
    }

    public static string GetTenantGroup(string tenantId)
        => $"tenant:{tenantId}";

    private static string? ResolveTenantId(HubCallerContext context)
    {
        var http = context.GetHttpContext();
        if (http is null) return null;

        var fromQuery = http.Request.Query["tenantId"].ToString();
        if (!string.IsNullOrWhiteSpace(fromQuery))
            return fromQuery.Trim().ToLowerInvariant();

        if (http.Request.Headers.TryGetValue(TenantMiddleware.TenantHeaderName, out var tenantHeader))
            return tenantHeader.ToString().Trim().ToLowerInvariant();

        return null;
    }
}
