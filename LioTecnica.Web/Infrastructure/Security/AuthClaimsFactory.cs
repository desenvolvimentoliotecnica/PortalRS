using System.Security.Claims;
using LioTecnica.Web.ViewModels.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace LioTecnica.Web.Infrastructure.Security;

public static class AuthClaimsFactory
{
    /// <param name="fallbackTenantId">Used when response.TenantId is null/empty (e.g. API omits it); ensures the tenant claim is set so PortalTenantContext does not throw.</param>
    public static ClaimsPrincipal CreatePrincipal(LoginResponse response, string? fallbackTenantId = null)
    {
        var tenantId = !string.IsNullOrWhiteSpace(response.TenantId)
            ? response.TenantId
            : (fallbackTenantId?.Trim() ?? string.Empty);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, response.UserId.ToString()),
            new(ClaimTypes.Email, response.Email),
            new(ClaimTypes.Name, response.FullName),
            new("tenant", tenantId),
            new("access_token", response.AccessToken)
        };

        foreach (var role in response.Roles ?? Array.Empty<string>())
            claims.Add(new Claim(ClaimTypes.Role, role));

        foreach (var permission in response.Permissions ?? Array.Empty<string>())
            claims.Add(new Claim("permission", permission));

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        return new ClaimsPrincipal(identity);
    }

    public static ClaimsPrincipal CreatePrincipalForOwner(OwnerLoginResponse response)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, response.OwnerId.ToString()),
            new(ClaimTypes.Email, response.Email),
            new(ClaimTypes.Name, response.Email),
            new("tenant", response.TenantId),
            new("access_token", response.AccessToken)
        };

        foreach (var role in response.Roles ?? Array.Empty<string>())
            claims.Add(new Claim(ClaimTypes.Role, role));

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        return new ClaimsPrincipal(identity);
    }

    /// <summary>
    /// Builds a new principal from the current user with updated access_token and tenant claims (for switch-tenant).
    /// </summary>
    public static ClaimsPrincipal CreatePrincipalWithSwitchedTenant(ClaimsPrincipal currentUser, string newAccessToken, string newTenantId)
    {
        var claims = currentUser.Claims
            .Where(c => c.Type != "access_token" && c.Type != "tenant")
            .ToList();
        claims.Add(new Claim("access_token", newAccessToken));
        claims.Add(new Claim("tenant", newTenantId));

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        return new ClaimsPrincipal(identity);
    }
}
