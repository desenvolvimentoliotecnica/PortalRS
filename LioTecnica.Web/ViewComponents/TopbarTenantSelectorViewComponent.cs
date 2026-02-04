using System.Net;
using System.Security.Claims;
using LioTecnica.Web.Infrastructure.ApiClients;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.ViewComponents;

public sealed class TopbarTenantSelectorViewComponent : ViewComponent
{
    private readonly MeApiClient _meApi;

    public TopbarTenantSelectorViewComponent(MeApiClient meApi)
    {
        _meApi = meApi;
    }

    public async Task<IViewComponentResult> InvokeAsync()
    {
        if (User?.Identity?.IsAuthenticated != true)
        {
            return View("Default", (Tenants: Array.Empty<AllowedTenantItemDto>(), CurrentTenantId: (string?)null));
        }

        AllowedTenantsResponseDto? response;
        try
        {
            response = await _meApi.GetAllowedTenantsAsync(HttpContext.RequestAborted);
        }
        catch (HttpRequestException)
        {
            response = null;
        }
        catch (TaskCanceledException)
        {
            response = null;
        }

        var tenants = response?.Tenants ?? Array.Empty<AllowedTenantItemDto>();
        var currentTenantId = (User as ClaimsPrincipal)?.FindFirst("tenant")?.Value;

        return View("Default", (Tenants: tenants, CurrentTenantId: currentTenantId));
    }
}
