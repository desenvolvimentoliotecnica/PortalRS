using System.Security.Claims;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.ViewModels.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

[ApiController]
[Route("bff/navigation")]
public sealed class BffNavigationController : ControllerBase
{
    private readonly MenusApiClient _menusApi;

    public BffNavigationController(MenusApiClient menusApi)
    {
        _menusApi = menusApi;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (User?.Identity?.IsAuthenticated != true)
            return Unauthorized();

        var tenantId = User.FindFirst("tenant")?.Value?.Trim() ?? string.Empty;
        var isInTenantContext =
            !string.IsNullOrWhiteSpace(tenantId)
            && !string.Equals(tenantId, "owner", StringComparison.OrdinalIgnoreCase);

        var hasOwnerCookie = !string.IsNullOrWhiteSpace(HttpContext.Request.Cookies["OwnerAccessToken"]);
        var isOwnerContext = (User.IsInRole("Owner") || hasOwnerCookie) && !isInTenantContext;

        if (isOwnerContext)
        {
            return Ok(new NavigationResponse(new[]
            {
                new NavItem(
                    Id: "owner.tenants",
                    Label: "Tenants",
                    Href: "/Owner/Tenants",
                    Icon: "Building2",
                    OpenInNewTab: false,
                    Children: Array.Empty<NavItem>()),
                new NavItem(
                    Id: "owner.ia",
                    Label: "IA",
                    Href: "/Owner/IA",
                    Icon: "Brain",
                    OpenInNewTab: false,
                    Children: Array.Empty<NavItem>())
            }));
        }

        IReadOnlyList<MenuForCurrentUserViewModel> menus;
        try
        {
            menus = await _menusApi.ListForCurrentUserAsync(ct);
        }
        catch (HttpRequestException)
        {
            menus = Array.Empty<MenuForCurrentUserViewModel>();
        }
        catch (TaskCanceledException)
        {
            menus = Array.Empty<MenuForCurrentUserViewModel>();
        }

        var nodesById = menus.ToDictionary(
            x => x.Id,
            x => new NavItem(
                Id: x.Id.ToString("D"),
                Label: x.DisplayName,
                Href: string.IsNullOrWhiteSpace(x.Route) ? "#" : x.Route,
                Icon: string.IsNullOrWhiteSpace(x.Icon) ? null : x.Icon,
                OpenInNewTab: x.OpenInNewTab,
                Children: new List<NavItem>()),
            comparer: EqualityComparer<Guid>.Default);

        var roots = new List<(int Order, NavItem Node)>();

        foreach (var m in menus.OrderBy(x => x.Order))
        {
            if (!nodesById.TryGetValue(m.Id, out var node))
                continue;

            if (m.ParentId is null || !nodesById.TryGetValue(m.ParentId.Value, out var parent))
            {
                roots.Add((m.Order, node));
                continue;
            }

            if (parent.Children is List<NavItem> list)
                list.Add(node);
        }

        // Sort children lists by label to keep stable ordering when API doesn't guarantee child order.
        foreach (var n in nodesById.Values)
        {
            if (n.Children is List<NavItem> list && list.Count > 1)
            {
                list.Sort((a, b) => StringComparer.OrdinalIgnoreCase.Compare(a.Label, b.Label));
            }
        }

        var response = new NavigationResponse(roots.OrderBy(x => x.Order).Select(x => x.Node).ToArray());
        return Ok(response);
    }

    public sealed record NavigationResponse(IReadOnlyList<NavItem> Items);

    public sealed record NavItem(
        string Id,
        string Label,
        string Href,
        string? Icon,
        bool OpenInNewTab,
        IReadOnlyList<NavItem> Children);
}

